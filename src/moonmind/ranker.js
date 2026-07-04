const { debugLog } = require("./utils/debug");
const VECTOR_CONFIG = require("../../config/vectorConfig");

function toScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Documents arrive already fused by Reciprocal Rank Fusion (see ranking/rrf.js),
// each carrying `rrf_score` (fused rank signal) and `semantic_score` (raw Atlas
// cosine score). Ranking is therefore: optionally gate on absolute semantic
// similarity, then order by the fused score, then take the top N.
function rankDocuments(documents = [], limit = 5, options = {}) {
  const minSemanticScore =
    typeof options.minSemanticScore === "number"
      ? options.minSemanticScore
      : VECTOR_CONFIG.MIN_SEMANTIC_SCORE;

  const gated =
    minSemanticScore > 0
      ? documents.filter(
          (document) => toScore(document.semantic_score) >= minSemanticScore,
        )
      : documents;

  const ranked = [...gated]
    .map((document) => ({
      ...document,
      // Surface the fused score as `score` for downstream logging / API output.
      score: toScore(document.rrf_score),
    }))
    .sort((left, right) => {
      if ((right.score ?? 0) !== (left.score ?? 0)) {
        return (right.score ?? 0) - (left.score ?? 0);
      }

      return String(left.id).localeCompare(String(right.id));
    })
    .slice(0, limit);

  debugLog("moonmind.ranker.scored", {
    inputCount: documents.length,
    gatedCount: gated.length,
    minSemanticScore,
    returnedCount: ranked.length,
    ranked: ranked.map((document) => ({
      id: document.id,
      score: document.score,
      semantic_score: toScore(document.semantic_score),
      sources: document.retrieval_sources || {},
    })),
  });

  return ranked;
}

module.exports = {
  rankDocuments,
};
