const { debugLog } = require("./utils/debug");

function clampScore(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function rankDocuments(documents = [], limit = 5) {
  const ranked = [...documents]
    .map((document) => {
      const semanticScore = clampScore(document.semantic_score ?? 0);
      const keywordScore = clampScore(document.keyword_match ?? 0);
      const metadataScore = clampScore(document.metadata_match ?? 0);

      return {
        ...document,
        score: Number(
          (
            semanticScore * 0.5 +
            keywordScore * 0.3 +
            metadataScore * 0.2
          ).toFixed(6),
        ),
      };
    })
    .sort((left, right) => {
      if ((right.score ?? 0) !== (left.score ?? 0)) {
        return (right.score ?? 0) - (left.score ?? 0);
      }

      return String(left.id).localeCompare(String(right.id));
    })
    .slice(0, limit);

  debugLog("moonmind.ranker.scored", {
    inputCount: documents.length,
    returnedCount: ranked.length,
    ranked: ranked.map((document) => ({
      id: document.id,
      score: document.score,
      semantic: clampScore(document.semantic_score ?? 0),
      keyword: clampScore(document.keyword_match ?? 0),
      metadata: clampScore(document.metadata_match ?? 0),
    })),
  });

  return ranked;
}

module.exports = {
  rankDocuments,
};
