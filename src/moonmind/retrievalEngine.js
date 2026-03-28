const { connectToDatabase } = require("../../mongo");
const { vectorSearch } = require("./retrieval/vectorSearch");
const { debugLog } = require("./utils/debug");

const VECTOR_COLLECTION =
  process.env.MOONMIND_VECTOR_COLLECTION || "moonmind_documents";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDocument(document) {
  return {
    id: document.id,
    title: document.title,
    category: document.category,
    summary_for_embedding: document.summary_for_embedding,
    content_full: document.content_full,
    metadata: document.metadata || {},
  };
}

function buildEntityTerms(intentPayload) {
  const entities = intentPayload?.entities || {};

  return [
    ...(entities.skills || []),
    ...(entities.projects || []),
    ...(entities.certifications || []),
    ...(entities.organizations || []),
  ].filter(Boolean);
}

function buildMetadataQuery(intentPayload, runtimeMetadata = {}) {
  const clauses = [];
  const domainFilters = intentPayload?.filters?.domain || [];
  const entityTerms = buildEntityTerms(intentPayload);
  const dateRange = intentPayload?.entities?.dates || {};

  if (domainFilters.length > 0) {
    clauses.push({
      $or: [
        { "metadata.domain": { $in: domainFilters } },
        { category: { $in: domainFilters } },
      ],
    });
  }

  if (entityTerms.length > 0) {
    clauses.push({
      $or: entityTerms.map((term) => {
        const regex = { $regex: escapeRegex(term), $options: "i" };

        return {
          $or: [
            { title: regex },
            { category: regex },
            { tags: regex },
            { "metadata.domain": regex },
            { "metadata.subcategory": regex },
          ],
        };
      }),
    });
  }

  if (dateRange.from || dateRange.to) {
    const dateClause = {};

    if (dateRange.from) {
      dateClause.$gte = dateRange.from;
    }

    if (dateRange.to) {
      dateClause.$lte = dateRange.to;
    }

    clauses.push({
      $or: [
        { "metadata.date_start": dateClause },
        { "metadata.date_end": dateClause },
      ],
    });
  }

  Object.entries(runtimeMetadata || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    clauses.push({ [`metadata.${key}`]: value });
  });

  return clauses.length > 0 ? { $and: clauses } : {};
}

function buildKeywordQuery(query, intentPayload) {
  const tokens = [
    query,
    ...buildEntityTerms(intentPayload),
    ...(intentPayload?.filters?.domain || []),
  ]
    .join(" ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  const uniqueTokens = [...new Set(tokens)];

  if (uniqueTokens.length === 0) {
    return {};
  }

  return {
    $or: uniqueTokens.map((token) => {
      const regex = { $regex: escapeRegex(token), $options: "i" };

      return {
        $or: [
          { title: regex },
          { tags: regex },
          { content_full: regex },
          { summary_for_embedding: regex },
        ],
      };
    }),
  };
}

async function runMongoQuery(query, limit) {
  if (!query || Object.keys(query).length === 0) {
    return [];
  }

  const { db } = await connectToDatabase({ apiStrict: false });
  const collection = db.collection(VECTOR_COLLECTION);

  const results = await collection
    .find(query, {
      projection: {
        _id: 0,
        id: 1,
        title: 1,
        category: 1,
        summary_for_embedding: 1,
        content_full: 1,
        metadata: 1,
        tags: 1,
      },
    })
    .limit(limit)
    .toArray();

  return results.map(normalizeDocument);
}

function mergeDocuments(resultSets) {
  const merged = new Map();

  resultSets.forEach(({ source, documents }) => {
    documents.forEach((document, index) => {
      const id = String(document.id);
      const existing = merged.get(id) || {
        ...normalizeDocument(document),
        semantic_score: 0,
        keyword_match: 0,
        metadata_match: 0,
      };

      if (source === "semantic") {
        existing.semantic_score = Math.max(
          existing.semantic_score,
          Number(document.score) || Math.max(0, 1 - index * 0.1),
        );
      }

      if (source === "keyword") {
        existing.keyword_match = Math.max(
          existing.keyword_match,
          Math.max(0.2, 1 - index * 0.1),
        );
      }

      if (source === "metadata") {
        existing.metadata_match = Math.max(
          existing.metadata_match,
          Math.max(0.3, 1 - index * 0.1),
        );
      }

      merged.set(id, existing);
    });
  });

  return Array.from(merged.values());
}

async function retrieveDocuments({
  query,
  intentPayload,
  metadata = {},
  limit = 10,
}) {
  const retrievalPlan = intentPayload?.retrieval_plan || {};
  const selectedStrategies = Object.entries(retrievalPlan)
    .filter(([, enabled]) => enabled)
    .map(([strategy]) => strategy);

  debugLog("moonmind.retrieval.start", {
    query,
    selectedStrategies,
  });

  const tasks = [];

  if (retrievalPlan.semantic) {
    tasks.push(
      vectorSearch(query, Math.max(limit, 10)).then((documents) => ({
        source: "semantic",
        documents,
      })),
    );
  }

  if (retrievalPlan.keyword) {
    tasks.push(
      runMongoQuery(
        buildKeywordQuery(query, intentPayload),
        Math.max(limit, 10),
      ).then((documents) => ({
        source: "keyword",
        documents,
      })),
    );
  }

  if (retrievalPlan.metadata) {
    tasks.push(
      runMongoQuery(
        buildMetadataQuery(intentPayload, metadata),
        Math.max(limit, 10),
      ).then((documents) => ({
        source: "metadata",
        documents,
      })),
    );
  }

  const settled = await Promise.all(tasks);
  const documents = mergeDocuments(settled);

  debugLog("moonmind.retrieval.complete", {
    query,
    selectedStrategies,
    resultsCount: documents.length,
  });

  return {
    selectedStrategies,
    documents,
  };
}

module.exports = {
  buildMetadataQuery,
  buildKeywordQuery,
  retrieveDocuments,
};
