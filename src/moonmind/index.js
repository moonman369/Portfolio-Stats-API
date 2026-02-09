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

async function runMoonMind({ prompt, sessionId, metadata }) {
  if (!prompt || typeof prompt !== "string") {
    throw new MoonMindError("Prompt is required", { code: "INVALID_INPUT" });
  }

  const requestId = crypto.randomUUID();

  const intentReport = await extractIntent({ prompt, requestId, sessionId });
  assertValidIntentReport(intentReport);

  if (metadata?.leetcodeUsername && !intentReport.entities.leetcodeUsername) {
    intentReport.entities.leetcodeUsername = metadata.leetcodeUsername;
  }

  const scope = validateScope(intentReport);
  const plan = buildExecutionPlan(intentReport);

  if (!scope.allowed) {
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
    const message = await composeGreeting(prompt);
    return {
      status: "success",
      mode: "greeting",
      intentReport,
      plan,
      message,
    };
  }

  if (intentReport.execution.responseStyle === "factual") {
    const message = await composeFactual(prompt);
    return {
      status: "success",
      mode: "factual",
      intentReport,
      plan,
      message,
    };
  }

  if (intentReport.execution.responseStyle === "denial") {
    return {
      status: "rejected",
      mode: "denial",
      intentReport,
      plan,
      message: intentReport.message,
    };
  }

  const retrievalResult = await retrieve(intentReport);
  const ranked = rankResults(retrievalResult);

  if (ranked?.missing) {
    return {
      status: "unknown",
      mode: "unknown",
      intentReport,
      plan,
      message: "unknown",
      data: intentReport.execution.responseStyle === "documents" ? [] : undefined,
    };
  }

  const responseText = await composeGroundedResponse(
    intentReport,
    ranked,
    intentReport.execution.responseStyle,
  );

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
}

module.exports = {
  runMoonMind,
};
