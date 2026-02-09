const { connectToDatabase } = require("../../../mongo");
const { vectorSearch } = require("./vectorSearch");

const VECTOR_COLLECTION =
  process.env.MOONMIND_VECTOR_COLLECTION || "moonmind_documents";

const SCORE_WEIGHTS = {
  semantic: 0.7,
  keyword: 0.2,
  metadata: 0.1,
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDoc(doc) {
  return {
    _id: doc._id,
    content: doc.content,
    metadata: doc.metadata,
    score: doc.score ?? 0,
  };
}

function buildMetadataQuery(filters) {
  const clauses = [];

  if (filters.topics?.length) {
    clauses.push({ "metadata.topics": { $in: filters.topics } });
    clauses.push({ "metadata.tags": { $in: filters.topics } });
    clauses.push({ "metadata.category": { $in: filters.topics } });
  }

  if (filters.documentTypes?.length) {
    clauses.push({ "metadata.type": { $in: filters.documentTypes } });
    clauses.push({ "metadata.documentType": { $in: filters.documentTypes } });
  }

  if (filters.timeRange) {
    clauses.push({ "metadata.timeRange": filters.timeRange });
    clauses.push({ "metadata.date": filters.timeRange });
    clauses.push({ "metadata.year": filters.timeRange });
  }

  if (clauses.length === 0) {
    return null;
  }

  return { $or: clauses };
}

async function metadataSearch({ filters, limit }) {
  const query = buildMetadataQuery(filters);
  if (!query) {
    return [];
  }

  const { db } = await connectToDatabase();
  const collection = db.collection(VECTOR_COLLECTION);

  const results = await collection
    .find(query, { projection: { content: 1, metadata: 1 } })
    .limit(Math.max(limit * 3, 10))
    .toArray();

  return results.map((doc) => ({ ...normalizeDoc(doc), score: 0.5 }));
}

function buildKeywordQuery(keywords) {
  if (!keywords?.length) {
    return null;
  }

  const clauses = [];
  keywords.forEach((keyword) => {
    const safeKeyword = escapeRegex(keyword);
    const regex = { $regex: safeKeyword, $options: "i" };
    clauses.push({ content: regex });
    clauses.push({ "metadata.title": regex });
    clauses.push({ "metadata.summary": regex });
    clauses.push({ "metadata.tags": regex });
  });

  if (clauses.length === 0) {
    return null;
  }

  return { $or: clauses };
}

async function keywordSearch({ keywords, limit }) {
  const query = buildKeywordQuery(keywords);
  if (!query) {
    return [];
  }

  const { db } = await connectToDatabase();
  const collection = db.collection(VECTOR_COLLECTION);

  const results = await collection
    .find(query, { projection: { content: 1, metadata: 1 } })
    .limit(Math.max(limit * 4, 12))
    .toArray();

  return results.map((doc) => ({ ...normalizeDoc(doc), score: 1 }));
}

function mergeResults({ metadataResults, keywordResults, semanticResults }) {
  const merged = new Map();

  const applyResults = (docs, source) => {
    docs.forEach((doc) => {
      const key = String(doc._id);
      const existing = merged.get(key) ?? {
        _id: doc._id,
        content: doc.content,
        metadata: doc.metadata,
        stageScores: {
          semantic: 0,
          keyword: 0,
          metadata: 0,
        },
      };

      if (source === "semantic") {
        existing.stageScores.semantic = Math.max(
          existing.stageScores.semantic,
          doc.score ?? 0,
        );
      }
      if (source === "keyword") {
        existing.stageScores.keyword = Math.max(
          existing.stageScores.keyword,
          doc.score ?? 0,
        );
      }
      if (source === "metadata") {
        existing.stageScores.metadata = Math.max(
          existing.stageScores.metadata,
          doc.score ?? 0,
        );
      }

      merged.set(key, existing);
    });
  };

  applyResults(metadataResults, "metadata");
  applyResults(keywordResults, "keyword");
  applyResults(semanticResults, "semantic");

  return Array.from(merged.values()).map((doc) => {
    const combinedScore =
      doc.stageScores.semantic * SCORE_WEIGHTS.semantic +
      doc.stageScores.keyword * SCORE_WEIGHTS.keyword +
      doc.stageScores.metadata * SCORE_WEIGHTS.metadata;

    return {
      _id: doc._id,
      content: doc.content,
      metadata: doc.metadata,
      score: combinedScore,
      stageScores: doc.stageScores,
    };
  });
}

function rerankResults(items, limit) {
  return [...items]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

async function fullSearch({ semanticQuery, keywords, filters, limit }) {
  const safeLimit = limit ?? 5;

  const [metadataResults, keywordResults, semanticResults] =
    await Promise.all([
      metadataSearch({ filters, limit: safeLimit }),
      keywordSearch({ keywords, limit: safeLimit }),
      vectorSearch(semanticQuery, Math.max(safeLimit * 2, 8)),
    ]);

  const merged = mergeResults({
    metadataResults,
    keywordResults,
    semanticResults,
  });
  const ranked = rerankResults(merged, safeLimit);

  return {
    type: "full_search",
    items: ranked,
    missing: ranked.length === 0,
  };
}

module.exports = {
  fullSearch,
};
