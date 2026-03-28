function decideResponseMode(intentReport, retrievalResult) {
  if (intentReport.response?.mode === "raw") {
    return "raw";
  }

  if (retrievalResult?.missing) {
    return "unknown";
  }

  return intentReport.response?.mode || "grounded";
}

module.exports = {
  decideResponseMode,
};
