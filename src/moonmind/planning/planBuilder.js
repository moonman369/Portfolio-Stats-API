function buildExecutionPlan(intentReport) {
  const plan = [];

  plan.push({ step: "receipt", action: "acknowledge_request" });
  plan.push({ step: "intent", action: "validate_intent" });
  plan.push({ step: "scope", action: "scope_gate" });

  if (intentReport.execution.retrieval === "github_stats") {
    plan.push({ step: "retrieve", action: "fetch_github_stats" });
  } else if (intentReport.execution.retrieval === "leetcode_stats") {
    plan.push({ step: "retrieve", action: "fetch_leetcode_stats" });
  } else if (intentReport.execution.retrieval === "full_search") {
    plan.push({ step: "retrieve", action: "metadata_search" });
    plan.push({ step: "retrieve", action: "keyword_search" });
    plan.push({ step: "retrieve", action: "semantic_search" });
    plan.push({ step: "rank", action: "rerank" });
    plan.push({ step: "select", action: "top_n" });
  } else {
    plan.push({ step: "retrieve", action: "none" });
  }

  plan.push({ step: "respond", action: "compose_response" });

  return plan;
}

module.exports = {
  buildExecutionPlan,
};
