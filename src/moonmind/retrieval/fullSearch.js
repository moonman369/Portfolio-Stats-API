const { connectToDatabase } = require("../../../mongo");
const { vectorSearch } = require("./vectorSearch");
const { debugLog } = require("../utils/debug");

const VECTOR_COLLECTION =
  process.env.MOONMIND_VECTOR_COLLECTION || "moonmind_documents";

const SCORE_WEIGHTS = {
  semantic: 0.65,
  keyword: 0.25,
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

function buildMetadataQuery(metadataFilters) {
  if (!metadataFilters?.length) {
    return null;
  }

  const clauses = metadataFilters.map((filter) => {
    const safe = escapeRegex(filter);
    const regex = { $regex: safe, $options: "i" };
    return {
      $or: [
        { "metadata.topics": regex },
        { "metadata.tags": regex },
        { "metadata.category": regex },
        { "metadata.type": regex },
      ],
    };
  });

  return clauses.length ? { $and: clauses } : null;
}

function buildKeywordQuery(keywordFilters) {
  if (!keywordFilters?.length) {
    return null;
  }

  const clauses = keywordFilters.map((keyword) => {
    const safe = escapeRegex(keyword);
    const regex = { $regex: safe, $options: "i" };
    return {
      $or: [
        { content: regex },
        { "metadata.title": regex },
        { "metadata.summary": regex },
        { "metadata.tags": regex },
      ],
    };
  });

  return clauses.length ? { $or: clauses } : null;
}

function applyBooleanLogic({ metadataQuery, keywordQuery, operator, negations }) {
  const conditions = [metadataQuery, keywordQuery].filter(Boolean);
  let query = conditions.length
    ? operator === "OR"
      ? { $or: conditions }
      : { $and: conditions }
    : {};

  if (negations?.length) {
    const negationClauses = negations.map((term) => {
      const safe = escapeRegex(term);
      const regex = { $regex: safe, $options: "i" };
      return {
        $or: [
          { content: regex },
          { "metadata.title": regex },
          { "metadata.summary": regex },
          { "metadata.tags": regex },
        ],
      };
    });

    query = {
      ...query,
      $nor: negationClauses,
    };
  }

  return query;
}

async function mongoSearch(query, limit) {
  if (!query || Object.keys(query).length === 0) {
    return [];
  }

  const { db } = await connectToDatabase();
  const collection = db.collection(VECTOR_COLLECTION);

  const results = await collection
    .find(query, { projection: { content: 1, metadata: 1 } })
    .limit(limit)
    .toArray();

  return results.map((doc) => normalizeDoc(doc));
}

function mergeResults({ metadataResults, keywordResults, semanticResults }) {
  const merged = new Map();

  const apply = (docs, source) => {
    docs.forEach((doc) => {
      const key = String(doc._id);
      const existing = merged.get(key) || {
        _id: doc._id,
        content: doc.content,
        metadata: doc.metadata,
        stageScores: { semantic: 0, keyword: 0, metadata: 0 },
      };
      existing.stageScores[source] = Math.max(existing.stageScores[source], doc.score ?? 1);
      merged.set(key, existing);
    });
  };

  apply(metadataResults, "metadata");
  apply(keywordResults, "keyword");
  apply(semanticResults, "semantic");

  return Array.from(merged.values()).map((doc) => ({
    _id: doc._id,
    content: doc.content,
    metadata: doc.metadata,
    stageScores: doc.stageScores,
    score:
      doc.stageScores.semantic * SCORE_WEIGHTS.semantic +
      doc.stageScores.keyword * SCORE_WEIGHTS.keyword +
      doc.stageScores.metadata * SCORE_WEIGHTS.metadata,
  }));
}

function deterministicRerank(items) {
  return [...items].sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) {
      return (b.score ?? 0) - (a.score ?? 0);
    }
    return String(a._id).localeCompare(String(b._id));
  });
}

async function fullSearch({ semanticQuery, filters, booleanLogic, limit }) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;

  const metadataQuery = buildMetadataQuery(filters.metadata_filters);
  const keywordQuery = buildKeywordQuery(filters.keyword_filters);
  const searchQuery = applyBooleanLogic({
    metadataQuery,
    keywordQuery,
    operator: booleanLogic.operator,
    negations: [...(booleanLogic.negations || []), ...(filters.exclusions || [])],
  });

  debugLog("fullSearch.pipeline", {
    safeLimit,
    hasMetadataQuery: Boolean(metadataQuery),
    hasKeywordQuery: Boolean(keywordQuery),
    operator: booleanLogic.operator,
  });

  const [metadataResults, keywordResults, semanticResults] = await Promise.all([
    mongoSearch(metadataQuery, Math.max(safeLimit * 3, 10)).then((items) =>
      items.map((item) => ({ ...item, score: 0.7 })),
    ),
    mongoSearch(keywordQuery, Math.max(safeLimit * 4, 12)).then((items) =>
      items.map((item) => ({ ...item, score: 1 })),
    ),
    vectorSearch(semanticQuery, Math.max(safeLimit * 2, 8)),
  ]);

  const booleanFiltered =
    Object.keys(searchQuery).length === 0
      ? [...metadataResults, ...keywordResults]
      : await mongoSearch(searchQuery, Math.max(safeLimit * 5, 15)).then((items) =>
          items.map((item) => ({ ...item, score: 0.85 })),
        );

  const merged = mergeResults({
    metadataResults: [...metadataResults, ...booleanFiltered],
    keywordResults,
    semanticResults,
  });

  const reranked = deterministicRerank(merged);
  const selected = reranked.slice(0, safeLimit);

  return {
    type: "full_search",
    items: selected,
    missing: selected.length === 0,
  };
}

module.exports = {
  fullSearch,
};
