const crypto = require("crypto");
const { extractIntent } = require("./intent/intentExtractor");
const {
  assertValidIntentReport,
  getExecutionDirective,
} = require("./intent/intentValidator");
const { validateScope } = require("./gate/scopeValidator");
const { buildExecutionPlan } = require("./planning/planBuilder");
const { retrieve } = require("./retrieval/retrievalEngine");
const { rankResults } = require("./ranking/rankingEngine");
const {
  composeGreeting,
  composeFactual,
  composeGroundedResponse,
} = require("./response/responseComposer");
const { MoonMindError } = require("./utils/errors");
const { debugLog, serializeError } = require("./utils/debug");

async function runMoonMind({ prompt, sessionId, metadata }) {
  const requestId = crypto.randomUUID();

  try {
    if (!prompt || typeof prompt !== "string") {
      throw new MoonMindError("Prompt is required", { code: "INVALID_INPUT" });
    }

    const intentReport = assertValidIntentReport(
      await extractIntent({ prompt, requestId, sessionId }),
    );
    const directive = getExecutionDirective(intentReport);
    const scope = validateScope(intentReport);
    const plan = buildExecutionPlan(intentReport, directive);

    if (!scope.allowed) {
      return {
        status: "rejected",
        mode: "redirect",
        intentReport,
        plan,
        message: scope.message,
      };
    }

    if (!intentReport.logical_validity.is_consistent) {
      return {
        status: "rejected",
        mode: "conflict",
        intentReport,
        plan,
        message: `Request has conflicting constraints: ${intentReport.logical_validity.conflicts.join(
          "; ",
        )}`,
      };
    }

    if (intentReport.modifiers.is_ambiguous) {
      return {
        status: "needs_clarification",
        mode: "clarification",
        intentReport,
        plan,
        message: intentReport.clarification_question,
      };
    }

    if (directive.mode === "greeting") {
      const message = await composeGreeting(prompt);
      return { status: "success", mode: "greeting", intentReport, plan, message };
    }

    if (directive.mode === "factual") {
      const message = await composeFactual(prompt);
      return { status: "success", mode: "factual", intentReport, plan, message };
    }

    if (directive.mode === "unsupported") {
      return {
        status: "rejected",
        mode: "unsupported",
        intentReport,
        plan,
        message:
          intentReport.polite_redirect_message ||
          "I can help with portfolio, software development, science, technology, GitHub stats, or LeetCode stats.",
      };
    }

    const retrievalResult = await retrieve(intentReport, directive, metadata);
    const ranked = rankResults(retrievalResult);

    if (ranked?.missing) {
      return {
        status: "unknown",
        mode: "unknown",
        intentReport,
        plan,
        message: "unknown",
      };
    }

    const intro = intentReport.modifiers.has_greeting_prefix ? "Great question. " : "";
    const style =
      directive.mode === "fetch_documents"
        ? "documents"
        : directive.mode === "summarize_aspect"
          ? "summary"
          : "grounded";
    const responseText = await composeGroundedResponse(intentReport, ranked, style);

    return {
      status: "success",
      mode: directive.mode,
      intentReport,
      plan,
      message: `${intro}${responseText}`.trim(),
      data: ranked.items,
    };
  } catch (error) {
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
