const { connectToDatabase } = require("../../mongo");
const { vectorSearch } = require("./retrieval/vectorSearch");
const { fuseByRRF } = require("./ranking/rrf");
const { debugLog } = require("./utils/debug");
const VECTOR_CONFIG = require("../../config/vectorConfig");

// Per-arm weights for RRF. The metadata arm is a broad filter match rather than
// a relevance ranking, so it contributes at a reduced weight.
const RRF_WEIGHTS = Object.freeze({
  semantic: 1,
  keyword: 1,
  metadata: 0.5,
});

// Use the same collection the write path (vectorMemoryService) persists to,
// so read and write can never diverge on the default.
const VECTOR_COLLECTION = VECTOR_CONFIG.DOCUMENT_COLLECTION;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDocument(document) {
  const metadata = document.metadata || {};
  const normalizedSubcategory = Array.isArray(metadata.subcategory)
    ? metadata.subcategory.filter((value) => typeof value === "string")
    : [];

  const normalizedDomain =
    typeof metadata.domain === "string" ? metadata.domain : null;

  if (
    normalizedDomain &&
    !VECTOR_CONFIG.ALLOWED_DOMAINS.includes(normalizedDomain)
  ) {
    console.warn("moonmind.retrieval.invalid_domain", {
      id: document.id,
      domain: normalizedDomain,
    });
  }

  return {
    id: document.id,
    title: document.title,
    category: document.category,
    summary_for_embedding: document.summary_for_embedding,
    content_full: document.content_full,
    metadata: {
      ...metadata,
      domain: VECTOR_CONFIG.ALLOWED_DOMAINS.includes(normalizedDomain)
        ? normalizedDomain
        : null,
      subcategory: normalizedSubcategory,
    },
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

  if (
    typeof intentPayload?.domain === "string" &&
    intentPayload.domain.trim()
  ) {
    clauses.push({ "metadata.domain": intentPayload.domain.trim() });
  }

  if (
    Array.isArray(intentPayload?.subcategories) &&
    intentPayload.subcategories.length > 0
  ) {
    clauses.push({
      "metadata.subcategory": { $in: intentPayload.subcategories },
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
    const upperBound = dateRange.to || new Date().toISOString();

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
        {
          $and: [
            { "metadata.date_start": { $lte: upperBound, $ne: null } },
            {
              $or: [
                { "metadata.date_end": null },
                { "metadata.date_end": { $exists: false } },
              ],
            },
          ],
        },
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

// Pre-filter for the $vectorSearch stage, restricted to the fields indexed as
// `filter` type in the autoEmbed index: category, metadata.domain and
// metadata.subcategory. $vectorSearch filters only support structured operators
// ($eq/$in/$and/$or...), so free-text/regex entity matching and date-range
// logic stay in the keyword and metadata arms.
function buildVectorSearchFilter(intentPayload) {
  const clauses = [];
  const domainFilters = intentPayload?.filters?.domain || [];

  if (domainFilters.length > 0) {
    clauses.push({
      $or: [
        { "metadata.domain": { $in: domainFilters } },
        { category: { $in: domainFilters } },
      ],
    });
  }

  if (
    typeof intentPayload?.domain === "string" &&
    intentPayload.domain.trim()
  ) {
    clauses.push({ "metadata.domain": { $eq: intentPayload.domain.trim() } });
  }

  if (
    Array.isArray(intentPayload?.subcategories) &&
    intentPayload.subcategories.length > 0
  ) {
    clauses.push({
      "metadata.subcategory": { $in: intentPayload.subcategories },
    });
  }

  if (clauses.length === 0) {
    return null;
  }

  return clauses.length === 1 ? clauses[0] : { $and: clauses };
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
    debugLog("moonmind.retrieval.mongo.skipped", { reason: "empty_query" });
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

async function retrieveDocuments({
  query,
  intentPayload,
  metadata = {},
  limit = VECTOR_CONFIG.VECTOR_SEARCH_LIMIT,
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
      vectorSearch(
        query,
        Math.max(limit, 10),
        buildVectorSearchFilter(intentPayload),
      ).then((rawDocuments) => {
        // Normalize like the other arms, but preserve the raw Atlas score so
        // RRF can carry semantic_score through for the threshold gate.
        const documents = rawDocuments.map((document) => ({
          ...normalizeDocument(document),
          score: Number(document.score),
        }));
        debugLog("moonmind.retrieval.strategy.result", {
          source: "semantic",
          count: documents.length,
        });
        return { source: "semantic", documents };
      }),
    );
  }

  if (retrievalPlan.keyword) {
    tasks.push(
      runMongoQuery(
        buildKeywordQuery(query, intentPayload),
        Math.max(limit, 10),
      ).then((documents) => {
        debugLog("moonmind.retrieval.strategy.result", {
          source: "keyword",
          count: documents.length,
        });
        return { source: "keyword", documents };
      }),
    );
  }

  if (retrievalPlan.metadata) {
    tasks.push(
      runMongoQuery(
        buildMetadataQuery(intentPayload, metadata),
        Math.max(limit, 10),
      ).then((documents) => {
        debugLog("moonmind.retrieval.strategy.result", {
          source: "metadata",
          count: documents.length,
        });
        return { source: "metadata", documents };
      }),
    );
  }

  const settled = await Promise.all(tasks);
  const documents = fuseByRRF(settled, {
    k: VECTOR_CONFIG.RRF_K,
    weights: RRF_WEIGHTS,
  });

  debugLog("moonmind.retrieval.complete", {
    query,
    selectedStrategies,
    perStrategyCounts: settled.map(({ source, documents: docs }) => ({
      source,
      count: docs.length,
    })),
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
  buildVectorSearchFilter,
  retrieveDocuments,
};
