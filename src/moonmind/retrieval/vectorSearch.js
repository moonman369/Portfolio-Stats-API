const { connectToDatabase } = require("../../../mongo");
const { createEmbedding } = require("../adapters/openaiClient");
const { debugLog, serializeError } = require("../utils/debug");

const EMBEDDING_MODEL =
  process.env.MOONMIND_EMBEDDING_MODEL || "text-embedding-3-small";
const VECTOR_COLLECTION =
  process.env.MOONMIND_VECTOR_COLLECTION || "moonmind_documents";
const VECTOR_INDEX =
  process.env.MOONMIND_VECTOR_INDEX || "moonmind_vector_index";
const VECTOR_FIELD = process.env.MOONMIND_VECTOR_FIELD || "embedding";

async function embedQuery(query) {
  debugLog("vectorSearch.embed.start", {
    queryLength: typeof query === "string" ? query.length : 0,
    model: EMBEDDING_MODEL,
  });
  const response = await createEmbedding({
    model: EMBEDDING_MODEL,
    input: query,
  });
  const embedding = response.data[0].embedding;
  debugLog("vectorSearch.embed.success", {
    dimensions: Array.isArray(embedding) ? embedding.length : 0,
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
          numCandidates: Math.max(limit * 5, 25),
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
