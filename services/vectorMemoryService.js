"use strict";

const { connectToDatabase } = require("../mongo");
const VECTOR_CONFIG = require("../config/vectorConfig");
const { vectorDocumentJsonSchema } = require("../models/vectorDocument");
const {
  validateCreatePayload,
  validateUpdatePayload,
  validateDeletePayload,
} = require("../validators/memoryValidator");
const {
  generateDeterministicSummary,
  buildEmbeddingText,
  generateDocumentEmbedding,
} = require("../utils/embeddingGenerator");

let schemaEnsured = false;

function sanitizeLegacyMetadata(metadata, id) {
  const source = metadata || {};
  const normalizedDomain =
    typeof source.domain === "string" ? source.domain : null;
  const isValidDomain = VECTOR_CONFIG.ALLOWED_DOMAINS.includes(normalizedDomain);

  if (normalizedDomain && !isValidDomain) {
    console.warn("vectorMemory.legacy.invalid_domain", {
      id,
      domain: normalizedDomain,
    });
  }

  return {
    ...source,
    domain: isValidDomain ? normalizedDomain : null,
    subcategory: Array.isArray(source.subcategory) ? source.subcategory : [],
  };
}


async function ensureStorage() {
  if (schemaEnsured) {
    return;
  }

  const { db } = await connectToDatabase({ apiStrict: false });
  const existing = await db
    .listCollections({ name: VECTOR_CONFIG.DOCUMENT_COLLECTION }, { nameOnly: true })
    .toArray();

  if (existing.length === 0) {
    await db.createCollection(VECTOR_CONFIG.DOCUMENT_COLLECTION, {
      validator: { $jsonSchema: vectorDocumentJsonSchema },
      validationLevel: "strict",
      validationAction: "error",
    });
  } else {
    try {
      await db.command({
        collMod: VECTOR_CONFIG.DOCUMENT_COLLECTION,
        validator: { $jsonSchema: vectorDocumentJsonSchema },
        validationLevel: "strict",
        validationAction: "error",
      });
    } catch (error) {
      const isUnauthorized =
        error?.code === 13 ||
        error?.codeName === "Unauthorized" ||
        /not allowed to do action \[collMod\]/i.test(error?.message || "");

      if (!isUnauthorized) {
        throw error;
      }
      console.error("vectorMemory.ensureStorage.collMod.unauthorized", {
        collection: VECTOR_CONFIG.DOCUMENT_COLLECTION,
        message: error?.message,
      });
    }
  }

  await db.collection(VECTOR_CONFIG.DOCUMENT_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(VECTOR_CONFIG.METADATA_INDEX_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(VECTOR_CONFIG.METADATA_INDEX_COLLECTION).createIndex({
    category: 1,
    "metadata.domain": 1,
    "metadata.verified": 1,
    "metadata.proficiency_level": 1,
    "metadata.date_end": -1,
    "metadata.impact_score": -1,
  });

  schemaEnsured = true;
}

function buildMetadataIndexDocument(vectorDoc) {
  return {
    id: vectorDoc.id,
    title: vectorDoc.title,
    category: vectorDoc.category,
    tags: vectorDoc.tags,
    content_full: vectorDoc.content_full,
    summary_for_embedding: vectorDoc.summary_for_embedding,
    metadata: sanitizeLegacyMetadata(vectorDoc.metadata, vectorDoc.id),
    updated_at: vectorDoc.updated_at,
  };
}

function hasRetrievalRelevantChanges(previousDoc, nextDoc) {
  const keys = [
    "title",
    "category",
    "tags",
    "content_full",
    "summary_for_embedding",
    "metadata",
  ];

  return keys.some(
    (key) => JSON.stringify(previousDoc[key]) !== JSON.stringify(nextDoc[key]),
  );
}

async function createDocument(payload) {
  await ensureStorage();
  const validated = validateCreatePayload(payload);
  const summary = validated.summary_for_embedding || generateDeterministicSummary(validated);
  const documentToPersist = {
    ...validated,
    summary_for_embedding: summary,
  };

  const embedding = await generateDocumentEmbedding(documentToPersist);

  const { client, db } = await connectToDatabase({ apiStrict: false });
  const session = client.startSession();
  const now = new Date().toISOString();

  const vectorDoc = {
    ...documentToPersist,
    embedding,
    created_at: now,
    updated_at: now,
  };

  try {
    await session.withTransaction(async () => {
      await db
        .collection(VECTOR_CONFIG.DOCUMENT_COLLECTION)
        .insertOne(vectorDoc, { session });

      await db.collection(VECTOR_CONFIG.METADATA_INDEX_COLLECTION).insertOne(
        buildMetadataIndexDocument(vectorDoc),
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return vectorDoc;
}

async function updateDocument(payload) {
  await ensureStorage();
  const validated = validateUpdatePayload(payload);

  const { client, db } = await connectToDatabase({ apiStrict: false });
  const collection = db.collection(VECTOR_CONFIG.DOCUMENT_COLLECTION);
  const existing = await collection.findOne({ id: validated.id });

  if (!existing) {
    const error = new Error("Document not found for provided id");
    error.name = "NotFoundError";
    throw error;
  }

  const summary = validated.summary_for_embedding || generateDeterministicSummary(validated);
  const normalizedUpdate = {
    ...validated,
    summary_for_embedding: summary,
  };

  // Re-embed whenever any input to the embedding text changes (title, tags,
  // content_full or summary), not just the summary field. Also re-embed when the
  // existing document has no vector yet, which is the case for every document
  // seeded into moonmind_documents_v3 before the Gemini migration.
  const embeddingInputChanged =
    buildEmbeddingText(existing) !== buildEmbeddingText(normalizedUpdate);
  const hasExistingEmbedding =
    Array.isArray(existing.embedding) && existing.embedding.length > 0;

  const embedding =
    embeddingInputChanged || !hasExistingEmbedding
      ? await generateDocumentEmbedding(normalizedUpdate)
      : existing.embedding;

  const updatedDoc = {
    ...normalizedUpdate,
    embedding,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
  };

  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const changed = hasRetrievalRelevantChanges(existing, updatedDoc);
      if (!changed) {
        return;
      }

      await db.collection(VECTOR_CONFIG.DOCUMENT_COLLECTION).replaceOne(
        { id: updatedDoc.id },
        updatedDoc,
        { session },
      );

      await db.collection(VECTOR_CONFIG.METADATA_INDEX_COLLECTION).replaceOne(
        { id: updatedDoc.id },
        buildMetadataIndexDocument(updatedDoc),
        { upsert: false, session },
      );
    });
  } finally {
    await session.endSession();
  }

  return updatedDoc;
}

async function deleteDocument(payload) {
  await ensureStorage();
  const { id } = validateDeletePayload(payload);
  const { client, db } = await connectToDatabase({ apiStrict: false });
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      const vectorDeletion = await db
        .collection(VECTOR_CONFIG.DOCUMENT_COLLECTION)
        .deleteOne({ id }, { session });

      if (vectorDeletion.deletedCount !== 1) {
        const error = new Error("Document not found for provided id");
        error.name = "NotFoundError";
        throw error;
      }

      const metadataDeletion = await db
        .collection(VECTOR_CONFIG.METADATA_INDEX_COLLECTION)
        .deleteOne({ id }, { session });

      if (metadataDeletion.deletedCount !== 1) {
        const error = new Error("Metadata index entry not found for provided id");
        error.name = "NotFoundError";
        throw error;
      }
    });
  } finally {
    await session.endSession();
  }

  return { id, deleted: true };
}

// Projection covering exactly the fields buildEmbeddingText() reads.
const EMBEDDING_SOURCE_PROJECTION = {
  _id: 0,
  id: 1,
  title: 1,
  tags: 1,
  summary_for_embedding: 1,
  content_full: 1,
};

// Documents seeded without a vector, or whose vector was written as empty/null.
const MISSING_EMBEDDING_FILTER = {
  $or: [
    { embedding: { $exists: false } },
    { embedding: null },
    { embedding: { $size: 0 } },
  ],
};

// The regeneration paths intentionally skip ensureStorage(). That helper applies
// a strict $jsonSchema via collMod, and moonmind_documents_v3 currently has no
// validator. Installing one mid-backfill would make every subsequent updateOne
// revalidate the whole document, so a single legacy doc with an out-of-enum
// metadata value would block its own re-embedding. Backfill first; the validator
// is still applied by the create/update paths.
async function embedAndStore(collection, document) {
  const embedding = await generateDocumentEmbedding(document);
  const updatedAt = new Date().toISOString();

  await collection.updateOne(
    { id: document.id },
    { $set: { embedding, updated_at: updatedAt } },
  );

  return { id: document.id, dimensions: embedding.length, updated_at: updatedAt };
}

async function regenerateDocumentEmbedding(id) {
  const { id: validatedId } = validateDeletePayload({ id });
  const { db } = await connectToDatabase({ apiStrict: false });
  const collection = db.collection(VECTOR_CONFIG.DOCUMENT_COLLECTION);

  const document = await collection.findOne(
    { id: validatedId },
    { projection: EMBEDDING_SOURCE_PROJECTION },
  );

  if (!document) {
    const error = new Error("Document not found for provided id");
    error.name = "NotFoundError";
    throw error;
  }

  return embedAndStore(collection, document);
}

/**
 * Re-embed every document, or only those missing a vector.
 *
 * Sequential by design: gemini-embedding-2 blends multiple inputs in one request
 * into a single vector, and issuing N concurrent requests is the fastest way to
 * hit the rate limit. Per-document failures are collected rather than thrown so
 * one bad document cannot abort the whole backfill.
 */
async function regenerateAllEmbeddings({ onlyMissing = false } = {}) {
  const { db } = await connectToDatabase({ apiStrict: false });
  const collection = db.collection(VECTOR_CONFIG.DOCUMENT_COLLECTION);
  const filter = onlyMissing ? MISSING_EMBEDDING_FILTER : {};

  const cursor = collection.find(filter, {
    projection: EMBEDDING_SOURCE_PROJECTION,
  });

  const failures = [];
  let processed = 0;
  let updated = 0;

  for (let document = await cursor.next(); document; document = await cursor.next()) {
    processed += 1;

    try {
      await embedAndStore(collection, document);
      updated += 1;
    } catch (error) {
      failures.push({
        id: document.id,
        error: { name: error?.name || "EmbeddingError" },
        message: error?.message || "Embedding generation failed",
      });
    }
  }

  return { onlyMissing, processed, updated, failed: failures.length, failures };
}

module.exports = {
  createDocument,
  updateDocument,
  deleteDocument,
  regenerateDocumentEmbedding,
  regenerateAllEmbeddings,
};
