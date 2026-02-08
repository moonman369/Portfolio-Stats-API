function buildExecutionPlan(intentReport) {
  const plan = [];

  plan.push({ step: "receipt", action: "acknowledge_request" });
  plan.push({ step: "intent", action: "validate_intent" });
  plan.push({ step: "scope", action: "scope_gate" });

  if (intentReport.intent === "github_stats") {
    plan.push({ step: "retrieve", action: "fetch_github_stats" });
  } else if (intentReport.intent === "leetcode_stats") {
    plan.push({ step: "retrieve", action: "fetch_leetcode_stats" });
  } else if (intentReport.intent === "portfolio_docs") {
    plan.push({ step: "retrieve", action: "vector_search_docs" });
  } else if (intentReport.intent === "capabilities") {
    plan.push({ step: "retrieve", action: "none" });
  }

  plan.push({ step: "rank", action: "mechanical_rank" });
  plan.push({ step: "respond", action: "compose_response" });

  return plan;
}

module.exports = {
  buildExecutionPlan,
};
