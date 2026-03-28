function rankResults(retrievalResult) {
  if (!retrievalResult || !Array.isArray(retrievalResult.items)) {
    return retrievalResult;
  }

  if (retrievalResult.type === "full_search") {
    const ranked = [...retrievalResult.items].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0),
    );
    return { ...retrievalResult, items: ranked };
  }

  if (retrievalResult.type === "portfolio_docs") {
    const ranked = [...retrievalResult.items].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0),
    );
    return { ...retrievalResult, items: ranked };
  }

  return retrievalResult;
}

module.exports = {
  rankResults,
};
