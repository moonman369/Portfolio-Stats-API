const ALLOWED_INTENTS = new Set([
  "github_stats",
  "leetcode_stats",
  "portfolio_docs",
  "capabilities",
]);

function validateScope(intentReport) {
  if (intentReport.safety?.outOfScope) {
    return { allowed: false, reason: "out_of_scope_flagged" };
  }

  if (!ALLOWED_INTENTS.has(intentReport.intent)) {
    return { allowed: false, reason: "intent_not_allowed" };
  }

  return { allowed: true };
}

module.exports = {
  validateScope,
};
