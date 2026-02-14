function buildExecutionPlan(intentReport, directive) {
  const plan = [];

  plan.push({ step: "receipt", action: "acknowledge_request" });
  plan.push({ step: "intent", action: "compile_intent" });
  plan.push({ step: "scope", action: "scope_gate" });
  plan.push({ step: "validity", action: "logical_consistency_gate" });
  plan.push({ step: "ambiguity", action: "clarification_gate" });

  if (directive.retrieval === "github_stats") {
    plan.push({ step: "retrieve", action: "fetch_github_stats" });
  } else if (directive.retrieval === "leetcode_stats") {
    plan.push({ step: "retrieve", action: "fetch_leetcode_stats" });
  } else if (directive.retrieval === "full_search") {
    plan.push({ step: "retrieve", action: "metadata_filters" });
    plan.push({ step: "retrieve", action: "keyword_filters" });
    plan.push({ step: "retrieve", action: "boolean_logic" });
    plan.push({ step: "retrieve", action: "semantic_vector_search" });
    plan.push({ step: "rank", action: "deterministic_reranking" });
    plan.push({ step: "select", action: "top_n" });
  } else {
    plan.push({ step: "retrieve", action: "none" });
  }

  plan.push({ step: "respond", action: directive.mode });

  return plan;
}

module.exports = {
  buildExecutionPlan,
};
