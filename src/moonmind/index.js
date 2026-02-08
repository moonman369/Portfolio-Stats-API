const crypto = require("crypto");
const { extractIntent } = require("./intent/intentExtractor");
const { assertValidIntentReport } = require("./intent/intentValidator");
const { validateScope } = require("./gate/scopeValidator");
const { buildExecutionPlan } = require("./planning/planBuilder");
const { retrieve } = require("./retrieval/retrievalEngine");
const { rankResults } = require("./ranking/rankingEngine");
const { decideResponseMode } = require("./response/responseMode");
const { composeGroundedResponse } = require("./response/responseComposer");
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
  if (!scope.allowed) {
    return {
      status: "rejected",
      reason: scope.reason,
      intentReport,
    };
  }

  const plan = buildExecutionPlan(intentReport);

  if (intentReport.intent === "capabilities") {
    return {
      status: "success",
      mode: "raw",
      intentReport,
      plan,
      data: {
        supportedIntents: [
          "github_stats",
          "leetcode_stats",
          "portfolio_docs",
        ],
        responseModes: ["raw", "grounded"],
      },
    };
  }
  const retrievalResult = await retrieve(intentReport);
  const ranked = rankResults(retrievalResult);
  const responseMode = decideResponseMode(intentReport, ranked);

  if (responseMode === "raw") {
    return {
      status: "success",
      mode: "raw",
      intentReport,
      plan,
      data: ranked.items,
    };
  }

  if (responseMode === "unknown") {
    return {
      status: "unknown",
      mode: "unknown",
      intentReport,
      plan,
      message: "unknown",
    };
  }

  const responseText = await composeGroundedResponse(intentReport, ranked);

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
