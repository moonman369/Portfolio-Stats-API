const { connectToDatabase } = require("../../../mongo");
const { createEmbedding } = require("../adapters/openaiClient");

const EMBEDDING_MODEL =
  process.env.MOONMIND_EMBEDDING_MODEL || "text-embedding-3-small";
const VECTOR_COLLECTION =
  process.env.MOONMIND_VECTOR_COLLECTION || "moonmind_documents";
const VECTOR_INDEX =
  process.env.MOONMIND_VECTOR_INDEX || "moonmind_vector_index";
const VECTOR_FIELD = process.env.MOONMIND_VECTOR_FIELD || "embedding";

async function embedQuery(query) {
  const response = await createEmbedding({
    model: EMBEDDING_MODEL,
    input: query,
  });
  return response.data[0].embedding;
}

async function vectorSearch(query, limit = 5) {
  const embedding = await embedQuery(query);
  const { db } = await connectToDatabase();
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
        _id: 1,
        content: 1,
        metadata: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ];

  const results = await collection.aggregate(pipeline).toArray();
  return results;
}

const vectorQueryExample = {
  collection: VECTOR_COLLECTION,
  pipeline: [
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        queryVector: "<embedding-array>",
        path: VECTOR_FIELD,
        numCandidates: 50,
        limit: 5,
      },
    },
    {
      $project: {
        _id: 1,
        content: 1,
        metadata: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ],
};

module.exports = {
  vectorSearch,
  vectorQueryExample,
};
