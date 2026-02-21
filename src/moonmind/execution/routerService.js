function determineRoute(intentReport, prompt) {
  const { primary_intent: primaryIntent, subtype } = intentReport;

  if (primaryIntent === "greeting") {
    return { mode: "greeting", action: "greeting_llm", objective: "greet" };
  }

  if (primaryIntent === "question") {
    if (subtype === "factual") {
      return { mode: "factual", action: "knowledge_llm", objective: "factual" };
    }

    if (subtype === "stats") {
      return { mode: "stats", action: "stats_fetch", objective: "format_stats" };
    }

    if (subtype === "portfolio_grounded") {
      return { mode: "retrieval", action: "full_search", objective: "grounded_answer" };
    }

    if (subtype === "portfolio_conceptual_hybrid") {
      return { mode: "hybrid", action: "full_search", objective: "synthesized_explanation" };
    }

    if (subtype === "unsupported") {
      return { mode: "redirect", action: "deny", objective: "redirect" };
    }
  }

  if (primaryIntent === "action") {
    if (subtype === "fetch_documents") {
      const shouldSummarize = /\bsummar(?:y|ize|ise)\b/i.test(prompt || "");
      return {
        mode: shouldSummarize ? "hybrid" : "retrieval",
        action: "full_search",
        objective: shouldSummarize ? "summarize_documents" : "return_documents",
      };
    }

    if (subtype === "summarize_aspect") {
      return { mode: "hybrid", action: "full_search", objective: "summarize_aspect" };
    }

    if (subtype === "compare_aspects") {
      return { mode: "hybrid", action: "full_search", objective: "compare_aspects" };
    }

    if (subtype === "timeline_view") {
      return { mode: "retrieval", action: "full_search", objective: "timeline_view" };
    }

    if (subtype === "count_items") {
      return { mode: "retrieval", action: "full_search", objective: "count_items" };
    }
  }

  if (subtype === "unsupported") {
    return { mode: "redirect", action: "deny", objective: "redirect" };
  }

  return { mode: "hybrid", action: "full_search", objective: "grounded_answer" };
}

module.exports = {
  determineRoute,
};
