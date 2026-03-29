const { connectToDatabase } = require("../../../mongo");
const { vectorSearch } = require("./vectorSearch");
const { debugLog } = require("../utils/debug");

const VECTOR_COLLECTION =
  process.env.MOONMIND_VECTOR_COLLECTION || "moonmind_documents";

const SCORE_WEIGHTS = {
  semantic: 0.6,
  keyword: 0.2,
  metadata: 0.1,
  recency: 0.05,
  verified: 0.05,
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDoc(doc) {
  return {
    id: doc.id,
    title: doc.title,
    category: doc.category,
    summary_for_embedding: doc.summary_for_embedding,
    metadata: doc.metadata || {},
    score: doc.score ?? 0,
  };
}

function parseDateScore(metadata = {}) {
  const inferredCurrentEnd =
    metadata.date_start &&
    (metadata.date_end === null || metadata.date_end === undefined)
      ? new Date().toISOString()
      : null;

  const candidates = [
    metadata.date_end,
    inferredCurrentEnd,
    metadata.date_start,
    metadata.completion_year,
  ]
    .filter(Boolean)
    .map((value) => {
      if (typeof value === "number") {
        return new Date(`${value}-01-01T00:00:00.000Z`).getTime();
      }
      return new Date(value).getTime();
    })
    .filter((value) => Number.isFinite(value));

  if (!candidates.length) {
    return 0;
  }

  const latest = Math.max(...candidates);
  const ageYears = Math.max(
    0,
    (Date.now() - latest) / (1000 * 60 * 60 * 24 * 365),
  );
  return Math.max(0, 1 - ageYears / 10);
}

function buildMetadataQuery({
  metadataFilters = [],
  domains = [],
  runtimeMetadata = {},
}) {
  const clauses = [];

  if (domains.length) {
    clauses.push({ "metadata.domain": { $in: domains } });
  }

  metadataFilters.forEach((filter) => {
    const safe = escapeRegex(filter);
    const regex = { $regex: safe, $options: "i" };
    clauses.push({
      $or: [
        { "metadata.domain": regex },
        { "metadata.subcategory": regex },
        { category: regex },
        { tags: regex },
      ],
    });
  });

  Object.entries(runtimeMetadata || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    clauses.push({ [`metadata.${key}`]: value });
  });

  return clauses.length ? { $and: clauses } : null;
}

function buildKeywordQuery(keywordFilters = []) {
  if (!keywordFilters.length) {
    return null;
  }

  return {
    $and: keywordFilters.map((keyword) => {
      const safe = escapeRegex(keyword);
      const regex = { $regex: safe, $options: "i" };
      return {
        $or: [{ title: regex }, { tags: regex }, { content_full: regex }],
      };
    }),
  };
}

function applyBooleanLogic({
  metadataQuery,
  keywordQuery,
  operator,
  negations,
}) {
  const conditions = [metadataQuery, keywordQuery].filter(Boolean);
  const base =
    conditions.length === 0
      ? {}
      : operator === "OR"
        ? { $or: conditions }
        : { $and: conditions };

  if (!negations?.length) {
    return base;
  }

  const negationClauses = negations.map((term) => {
    const safe = escapeRegex(term);
    const regex = { $regex: safe, $options: "i" };
    return {
      $or: [
        { title: regex },
        { tags: regex },
        { content_full: regex },
        { summary_for_embedding: regex },
      ],
    };
  });

  return {
    ...(base.$or || base.$and ? base : {}),
    $nor: negationClauses,
  };
}

async function mongoSearch(query, limit) {
  if (!query || Object.keys(query).length === 0) {
    return [];
  }

  const { db } = await connectToDatabase({ apiStrict: false });
  const collection = db.collection(VECTOR_COLLECTION);

  const results = await collection
    .find(query, {
      projection: {
        id: 1,
        title: 1,
        category: 1,
        summary_for_embedding: 1,
        metadata: 1,
      },
    })
    .limit(limit)
    .toArray();

  return results.map((doc) => normalizeDoc(doc));
}

function mergeResults({ metadataResults, keywordResults, semanticResults }) {
  const merged = new Map();

  const apply = (docs, source, fallbackScore) => {
    docs.forEach((doc) => {
      const key = String(doc.id);
      if (!key || key === "undefined") {
        return;
      }
      const existing = merged.get(key) || {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        summary_for_embedding: doc.summary_for_embedding,
        metadata: doc.metadata,
        stageScores: { semantic: 0, keyword: 0, metadata: 0 },
      };

      existing.stageScores[source] = Math.max(
        existing.stageScores[source],
        doc.score ?? fallbackScore,
      );
      merged.set(key, existing);
    });
  };

  apply(metadataResults, "metadata", 0.7);
  apply(keywordResults, "keyword", 0.8);
  apply(semanticResults, "semantic", 0.85);

  return Array.from(merged.values()).map((doc) => {
    const recencyScore = parseDateScore(doc.metadata);
    const verifiedScore = doc.metadata?.verified ? 1 : 0;

    const finalScore =
      doc.stageScores.semantic * SCORE_WEIGHTS.semantic +
      doc.stageScores.keyword * SCORE_WEIGHTS.keyword +
      doc.stageScores.metadata * SCORE_WEIGHTS.metadata +
      recencyScore * SCORE_WEIGHTS.recency +
      verifiedScore * SCORE_WEIGHTS.verified;

    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      summary_for_embedding: doc.summary_for_embedding,
      metadata: doc.metadata,
      score: Number(finalScore.toFixed(6)),
    };
  });
}

function deterministicRerank(items) {
  return [...items].sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) {
      return (b.score ?? 0) - (a.score ?? 0);
    }

    const aDate = parseDateScore(a.metadata);
    const bDate = parseDateScore(b.metadata);
    if (bDate !== aDate) {
      return bDate - aDate;
    }

    if (Boolean(b.metadata?.verified) !== Boolean(a.metadata?.verified)) {
      return (
        Number(Boolean(b.metadata?.verified)) -
        Number(Boolean(a.metadata?.verified))
      );
    }

    return String(a.id).localeCompare(String(b.id));
  });
}

async function fullSearch({
  semanticQuery,
  filters,
  booleanLogic,
  domains,
  runtimeMetadata,
  limit,
}) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;

  const metadataQuery = buildMetadataQuery({
    metadataFilters: filters.metadata_filters,
    domains,
    runtimeMetadata,
  });
  const keywordQuery = buildKeywordQuery(filters.keyword_filters);
  const booleanQuery = applyBooleanLogic({
    metadataQuery,
    keywordQuery,
    operator: booleanLogic.operator,
    negations: [
      ...(booleanLogic.negations || []),
      ...(filters.exclusions || []),
    ],
  });

  debugLog("fullSearch.pipeline", {
    safeLimit,
    hasMetadataQuery: Boolean(metadataQuery),
    hasKeywordQuery: Boolean(keywordQuery),
    operator: booleanLogic.operator,
    domainCount: domains?.length ?? 0,
  });

  const [metadataResults, keywordResults, booleanResults, semanticResults] =
    await Promise.all([
      mongoSearch(metadataQuery, Math.max(safeLimit * 3, 12)).then((items) =>
        items.map((item) => ({ ...item, score: 0.7 })),
      ),
      mongoSearch(keywordQuery, Math.max(safeLimit * 3, 12)).then((items) =>
        items.map((item) => ({ ...item, score: 0.8 })),
      ),
      mongoSearch(booleanQuery, Math.max(safeLimit * 4, 16)).then((items) =>
        items.map((item) => ({ ...item, score: 0.75 })),
      ),
      vectorSearch(semanticQuery, Math.max(safeLimit * 2, 10)),
    ]);

  const merged = mergeResults({
    metadataResults: [...metadataResults, ...booleanResults],
    keywordResults,
    semanticResults,
  });

  const selected = deterministicRerank(merged).slice(0, safeLimit);

  return {
    type: "full_search",
    items: selected,
    missing: selected.length === 0,
  };
}

module.exports = {
  fullSearch,
};
