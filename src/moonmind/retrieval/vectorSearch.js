const { connectToDatabase } = require("../../../mongo");
const { generateQueryEmbedding } = require("../../../utils/embeddingGenerator");
const { debugLog, serializeError } = require("../utils/debug");
const VECTOR_CONFIG = require("../../../config/vectorConfig");

// Resolve from the shared VECTOR_CONFIG so the read path stays aligned with the
// write path (same collection, index and embedding model).
const VECTOR_COLLECTION = VECTOR_CONFIG.DOCUMENT_COLLECTION;
const VECTOR_INDEX = VECTOR_CONFIG.VECTOR_INDEX_NAME;
const VECTOR_FIELD = VECTOR_CONFIG.VECTOR_FIELD;

// The query is embedded with the `task: search result | query: ...` template
// while documents use `title: ... | text: ...`. Both sides must keep using the
// templates in utils/embeddingGenerator.js or the vectors stop being comparable.
async function embedQuery(query) {
  debugLog("vectorSearch.embed.start", {
    queryLength: typeof query === "string" ? query.length : 0,
    model: VECTOR_CONFIG.EMBEDDING_MODEL,
  });
  const embedding = await generateQueryEmbedding(query);
  debugLog("vectorSearch.embed.success", {
    dimensions: embedding.length,
  });
  return embedding;
}

async function vectorSearch(query, limit = 5) {
  debugLog("vectorSearch.start", {
    limit,
    collection: VECTOR_COLLECTION,
    index: VECTOR_INDEX,
    field: VECTOR_FIELD,
  });

  try {
    const embedding = await embedQuery(query);
    const { db } = await connectToDatabase({ apiStrict: false });
    const collection = db.collection(VECTOR_COLLECTION);

    const pipeline = [
      {
        $vectorSearch: {
          index: VECTOR_INDEX,
          queryVector: embedding,
          path: VECTOR_FIELD,
          numCandidates: Math.max(limit * 5, VECTOR_CONFIG.VECTOR_NUM_CANDIDATES),
          limit,
        },
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

    const results = await collection.aggregate(pipeline).toArray();
    debugLog("vectorSearch.success", { count: results.length });
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
