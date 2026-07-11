"use strict";

/**
 * Backfill: recompute the `embedding` of documents in the vector collection with
 * Gemini, using the same code path as POST /documents/embeddings/regenerate.
 *
 * Usage:
 *   node scripts/reembed.js --dry-run       # report the embedding input, no writes
 *   node scripts/reembed.js                 # re-embed every document
 *   node scripts/reembed.js --only-missing  # embed only documents with no vector
 *
 * Safe to re-run: it only rewrites `embedding` + `updated_at`. Recommended: run
 * against a staging copy first and compare eval metrics
 * (scripts/eval/retrievalEval.js) before promoting to production.
 */

// Load .env from the project root regardless of the current working directory,
// so the script works when invoked as `node scripts/reembed.js` from anywhere.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { connectToDatabase } = require("../mongo");
const VECTOR_CONFIG = require("../config/vectorConfig");
const { buildEmbeddingText } = require("../utils/embeddingGenerator");
const { regenerateAllEmbeddings } = require("../services/vectorMemoryService");

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_MISSING = process.argv.includes("--only-missing");

async function reportDryRun() {
  const { db } = await connectToDatabase({ apiStrict: false });
  const collection = db.collection(VECTOR_CONFIG.DOCUMENT_COLLECTION);
  const filter = ONLY_MISSING ? { embedding: { $exists: false } } : {};

  const cursor = collection.find(filter, {
    projection: {
      _id: 0,
      id: 1,
      title: 1,
      tags: 1,
      content_full: 1,
      summary_for_embedding: 1,
    },
  });

  let processed = 0;
  for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
    processed += 1;
    const input = buildEmbeddingText(doc);
    console.log(`[dry-run] ${doc.id} :: ${input.slice(0, 120).replace(/\n/g, " ")}`);
  }

  console.log(`\nDone. processed=${processed} dryRun=true onlyMissing=${ONLY_MISSING}`);
  return 0;
}

async function main() {
  console.log(
    `collection=${VECTOR_CONFIG.DOCUMENT_COLLECTION} model=${VECTOR_CONFIG.EMBEDDING_MODEL} dims=${VECTOR_CONFIG.EMBEDDING_DIMENSIONS}`,
  );

  if (DRY_RUN) {
    process.exit(await reportDryRun());
  }

  const result = await regenerateAllEmbeddings({ onlyMissing: ONLY_MISSING });

  result.failures.forEach((failure) => {
    console.error(`[fail] ${failure.id}: ${failure.message}`);
  });

  console.log(
    `\nDone. processed=${result.processed} updated=${result.updated} failed=${result.failed} onlyMissing=${ONLY_MISSING}`,
  );
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("reembed.fatal", error);
  process.exit(1);
});
