const crypto = require("crypto");
const { extractIntent } = require("./intent/intentExtractor");
const { assertValidIntentReport } = require("./intent/intentValidator");
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
  debugLog("runMoonMind.start", {
    requestId,
    sessionId: sessionId ?? null,
    hasPrompt: typeof prompt === "string",
    metadataKeys: metadata ? Object.keys(metadata) : [],
  });

  try {
    if (!prompt || typeof prompt !== "string") {
      throw new MoonMindError("Prompt is required", { code: "INVALID_INPUT" });
    }

    debugLog("runMoonMind.extractIntent.start", { requestId });
    const intentReport = await extractIntent({ prompt, requestId, sessionId });
    debugLog("runMoonMind.extractIntent.success", {
      requestId,
      intentCategory: intentReport.intentCategory,
      intentSubtype: intentReport.intentSubtype,
      retrieval: intentReport.execution?.retrieval,
      responseStyle: intentReport.execution?.responseStyle,
    });

    debugLog("runMoonMind.intentValidation.start", { requestId });
    assertValidIntentReport(intentReport);
    debugLog("runMoonMind.intentValidation.success", { requestId });

    if (metadata?.leetcodeUsername && !intentReport.entities.leetcodeUsername) {
      intentReport.entities.leetcodeUsername = metadata.leetcodeUsername;
      debugLog("runMoonMind.entities.enriched", {
        requestId,
        field: "entities.leetcodeUsername",
      });
    }

    const scope = validateScope(intentReport);
    debugLog("runMoonMind.scope.result", {
      requestId,
      allowed: scope.allowed,
      reason: scope.reason ?? null,
    });

    const plan = buildExecutionPlan(intentReport);
    debugLog("runMoonMind.plan.built", {
      requestId,
      steps: Array.isArray(plan) ? plan.length : 0,
    });

    if (!scope.allowed) {
      debugLog("runMoonMind.exit.scopeRejected", { requestId });
      return {
        status: "rejected",
        reason: scope.reason,
        mode: "denial",
        intentReport,
        plan,
        message: intentReport.message || "Unable to assist with that request.",
      };
    }

    if (intentReport.execution.responseStyle === "greeting") {
      debugLog("runMoonMind.composeGreeting.start", { requestId });
      const message = await composeGreeting(prompt);
      debugLog("runMoonMind.composeGreeting.success", { requestId });
      return {
        status: "success",
        mode: "greeting",
        intentReport,
        plan,
        message,
      };
    }

    if (intentReport.execution.responseStyle === "factual") {
      debugLog("runMoonMind.composeFactual.start", { requestId });
      const message = await composeFactual(prompt);
      debugLog("runMoonMind.composeFactual.success", { requestId });
      return {
        status: "success",
        mode: "factual",
        intentReport,
        plan,
        message,
      };
    }

    if (intentReport.execution.responseStyle === "denial") {
      debugLog("runMoonMind.exit.denial", { requestId });
      return {
        status: "rejected",
        mode: "denial",
        intentReport,
        plan,
        message: intentReport.message,
      };
    }

    debugLog("runMoonMind.retrieve.start", {
      requestId,
      retrieval: intentReport.execution.retrieval,
    });
    const retrievalResult = await retrieve(intentReport);
    debugLog("runMoonMind.retrieve.success", {
      requestId,
      retrievalType: retrievalResult?.type,
      count: retrievalResult?.items?.length ?? 0,
      missing: Boolean(retrievalResult?.missing),
    });

    const ranked = rankResults(retrievalResult);
    debugLog("runMoonMind.rank.success", {
      requestId,
      count: ranked?.items?.length ?? 0,
      missing: Boolean(ranked?.missing),
    });

    if (ranked?.missing) {
      debugLog("runMoonMind.exit.unknown", { requestId });
      return {
        status: "unknown",
        mode: "unknown",
        intentReport,
        plan,
        message: "unknown",
        data: intentReport.execution.responseStyle === "documents" ? [] : undefined,
      };
    }

    debugLog("runMoonMind.composeGrounded.start", {
      requestId,
      style: intentReport.execution.responseStyle,
    });
    const responseText = await composeGroundedResponse(
      intentReport,
      ranked,
      intentReport.execution.responseStyle,
    );
    debugLog("runMoonMind.composeGrounded.success", { requestId });

    if (intentReport.execution.responseStyle === "documents") {
      return {
        status: "success",
        mode: "documents",
        intentReport,
        plan,
        message: responseText,
        data: ranked.items,
      };
    }

    if (intentReport.execution.responseStyle === "summary") {
      return {
        status: "success",
        mode: "summary",
        intentReport,
        plan,
        message: responseText,
        data: ranked.items,
      };
    }

    return {
      status: "success",
      mode: "grounded",
      intentReport,
      plan,
      message: responseText,
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
