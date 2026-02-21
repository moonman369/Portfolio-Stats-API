const crypto = require("crypto");
const { extractIntent } = require("./intent/intentExtractor");
const { assertValidIntentReport } = require("./intent/intentValidator");
const { validateScope } = require("./gate/scopeValidator");
const { retrieve } = require("./retrieval/retrievalEngine");
const {
  composeGreeting,
  composeFactual,
  composeStatsResponse,
  composeGroundedResponse,
} = require("./response/responseComposer");
const { determineRoute } = require("./execution/routerService");
const { MoonMindError } = require("./utils/errors");
const {
  buildSuccessResponse,
  buildRedirectResponse,
} = require("./utils/responseBuilder");
const { debugLog, serializeError } = require("./utils/debug");

function buildTimeline(documents) {
  return [...documents].sort((a, b) => {
    const aDate = new Date(a.metadata?.date_start || a.metadata?.date_end || 0).getTime() || 0;
    const bDate = new Date(b.metadata?.date_start || b.metadata?.date_end || 0).getTime() || 0;
    if (bDate !== aDate) {
      return bDate - aDate;
    }
    return String(a.id).localeCompare(String(b.id));
  });
}

async function runMoonMind({ prompt, sessionId, metadata = {} }) {
  const requestId = crypto.randomUUID();

  try {
    if (!prompt || typeof prompt !== "string") {
      throw new MoonMindError("Prompt is required", { code: "INVALID_INPUT" });
    }

    const intentReport = assertValidIntentReport(
      await extractIntent({ prompt, requestId, sessionId }),
    );

    const scope = validateScope(intentReport);
    const route = determineRoute(intentReport, prompt);

    if (!scope.allowed) {
      return buildRedirectResponse({
        intentReport,
        message: scope.message,
      });
    }

    if (!intentReport.logical_validity.is_consistent) {
      return buildRedirectResponse({
        intentReport,
        message: `Request has conflicting constraints: ${intentReport.logical_validity.conflicts.join("; ")}`,
      });
    }

    if (intentReport.modifiers.is_ambiguous) {
      return {
        status: "needs_clarification",
        intentReport,
        message: intentReport.clarification_question,
      };
    }

    if (route.mode === "redirect") {
      return buildRedirectResponse({
        intentReport,
        message:
          intentReport.polite_redirect_message ||
          "I can help with portfolio, software development, science, technology, GitHub stats, or LeetCode stats.",
      });
    }

    if (route.mode === "greeting") {
      const answer = await composeGreeting(prompt);
      return buildSuccessResponse({
        mode: "greeting",
        intentReport,
        data: { answer },
      });
    }

    if (route.mode === "factual") {
      const answer = await composeFactual(prompt);
      return buildSuccessResponse({
        mode: "factual",
        intentReport,
        data: { answer },
      });
    }

    if (route.mode === "stats") {
      const retrievalResult = await retrieve(intentReport, { retrieval: "github_stats" }, metadata, prompt);
      if (intentReport.domains.includes("leetcode stats")) {
        retrievalResult.items = (
          await retrieve(intentReport, { retrieval: "leetcode_stats" }, metadata, prompt)
        ).items;
      }

      if (retrievalResult.missing) {
        throw new MoonMindError("Stats data unavailable", { code: "MISSING_STATS" });
      }

      const answer = await composeStatsResponse(prompt, retrievalResult.items[0]);
      return buildSuccessResponse({
        mode: "stats",
        intentReport,
        data: { answer, stats: retrievalResult.items[0] },
      });
    }

    const retrievalResult = await retrieve(intentReport, { retrieval: "full_search" }, metadata, prompt);
    if (retrievalResult.missing) {
      return buildSuccessResponse({
        mode: route.mode,
        intentReport,
        data: {
          summary: "Insufficient data found in the portfolio documents for this request.",
          documents: [],
        },
      });
    }

    if (intentReport.subtype === "count_items") {
      return buildSuccessResponse({
        mode: "retrieval",
        intentReport,
        data: {
          count: retrievalResult.items.length,
          documents: retrievalResult.items,
        },
      });
    }

    if (intentReport.subtype === "timeline_view") {
      return buildSuccessResponse({
        mode: "retrieval",
        intentReport,
        data: {
          timeline: buildTimeline(retrievalResult.items),
          documents: retrievalResult.items,
        },
      });
    }

    const needsLlm = route.mode === "hybrid";
    if (!needsLlm) {
      return buildSuccessResponse({
        mode: "retrieval",
        intentReport,
        data: { documents: retrievalResult.items },
      });
    }

    const summary = await composeGroundedResponse({
      prompt,
      documents: retrievalResult.items,
      objective: route.objective,
    });

    return buildSuccessResponse({
      mode: "hybrid",
      intentReport,
      data: {
        summary,
        documents: retrievalResult.items,
      },
    });
  } catch (error) {
    console.error("runMoonMind.error", {
      requestId,
      message: error?.message,
      stack: error?.stack,
    });
    debugLog("runMoonMind.error", {
      requestId,
      error: serializeError(error),
    });
    throw error;
  }
}

module.exports = {
  runMoonMind,
};
