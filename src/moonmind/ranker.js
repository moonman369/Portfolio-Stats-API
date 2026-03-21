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
  return [...documents]
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
}

module.exports = {
  rankDocuments,
};
