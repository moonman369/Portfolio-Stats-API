const { connectToDatabase } = require("../../../mongo");
const { debugLog, serializeError } = require("../utils/debug");
const VECTOR_CONFIG = require("../../../config/vectorConfig");

// Atlas autoEmbed setup: the vector index embeds documents server-side (at
// insert/update) and embeds the query server-side at search time, so no
// client-side embedding call happens anywhere on this path. The raw query
// string goes straight into $vectorSearch via `query.text`.
//
// The index auto-embeds several text fields, but a $vectorSearch stage targets
// a single `path` — so we fan out one search per configured field in parallel
// and merge by document id, keeping the best score. This also covers documents
// whose `content_full` is null: they still surface via the summary/title paths.
const VECTOR_COLLECTION = VECTOR_CONFIG.DOCUMENT_COLLECTION;
const VECTOR_INDEX = VECTOR_CONFIG.VECTOR_INDEX_NAME;
const VECTOR_TEXT_FIELDS = VECTOR_CONFIG.VECTOR_TEXT_FIELD_PATHS;
const EMBEDDING_MODEL = VECTOR_CONFIG.EMBEDDING_MODEL;

async function searchByPath(collection, path, query, limit, filter) {
  const vectorSearchStage = {
    index: VECTOR_INDEX,
    path,
    query: { text: query },
    model: EMBEDDING_MODEL,
    numCandidates: Math.max(limit * 5, VECTOR_CONFIG.VECTOR_NUM_CANDIDATES),
    limit,
  };

  if (filter && Object.keys(filter).length > 0) {
    vectorSearchStage.filter = filter;
  }

  const pipeline = [
    {
      $vectorSearch: vectorSearchStage,
    },
    {
      $project: {
        _id: 0,
        id: 1,
        title: 1,
        category: 1,
        summary_for_embedding: 1,
        content_full: 1,
        metadata: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];

  return collection.aggregate(pipeline).toArray();
}

// Dedupe multi-path results by document id, keeping the copy with the highest
// score so the downstream semantic threshold gate sees the best field match.
function mergeByBestScore(resultSets, limit) {
  const merged = new Map();

  resultSets.forEach((results) => {
    results.forEach((document) => {
      const existing = merged.get(document.id);
      if (!existing || Number(document.score) > Number(existing.score)) {
        merged.set(document.id, document);
      }
    });
  });

  return Array.from(merged.values())
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, limit);
}

async function vectorSearch(
  query,
  limit = VECTOR_CONFIG.VECTOR_SEARCH_LIMIT,
  filter = null,
) {
  debugLog("vectorSearch.start", {
    limit,
    collection: VECTOR_COLLECTION,
    index: VECTOR_INDEX,
    fields: VECTOR_TEXT_FIELDS,
    model: EMBEDDING_MODEL,
    hasFilter: Boolean(filter),
  });

  try {
    const { db } = await connectToDatabase({ apiStrict: false });
    const collection = db.collection(VECTOR_COLLECTION);

    const resultSets = await Promise.all(
      VECTOR_TEXT_FIELDS.map((path) =>
        searchByPath(collection, path, query, limit, filter),
      ),
    );

    const results = mergeByBestScore(resultSets, limit);
    debugLog("vectorSearch.success", {
      count: results.length,
      perField: VECTOR_TEXT_FIELDS.map((path, index) => ({
        path,
        count: resultSets[index].length,
      })),
    });
    return results;
  } catch (error) {
    console.error("vectorSearch.error", {
      message: error?.message,
      stack: error?.stack,
    });
    debugLog("vectorSearch.error", { error: serializeError(error) });
    throw error;
  }
}

module.exports = {
  vectorSearch,
};
