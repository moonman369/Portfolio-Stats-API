const { intentReportSchema } = require("./intentReportSchema");
const { MoonMindError } = require("../utils/errors");

const INTENT_ENUM = new Set(intentReportSchema.properties.intent.enum);
const SOURCE_ENUM = new Set(intentReportSchema.properties.dataSources.items.enum);
const RESPONSE_MODE_ENUM = new Set(
  intentReportSchema.properties.response.properties.mode.enum,
);
const RESPONSE_FORMAT_ENUM = new Set(
  intentReportSchema.properties.response.properties.format.enum,
);

function assertString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new MoonMindError(`Invalid ${field}`, { field });
  }
}

function assertNullableString(value, field) {
  if (value !== null && typeof value !== "string") {
    throw new MoonMindError(`Invalid ${field}`, { field });
  }
}

function assertBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw new MoonMindError(`Invalid ${field}`, { field });
  }
}

function assertArray(value, field) {
  if (!Array.isArray(value)) {
    throw new MoonMindError(`Invalid ${field}`, { field });
  }
}

function assertValidIntentReport(report) {
  if (!report || typeof report !== "object") {
    throw new MoonMindError("Intent report validation failed", { field: "root" });
  }

  assertString(report.version, "version");
  if (report.version !== intentReportSchema.properties.version.const) {
    throw new MoonMindError("Invalid version", { field: "version" });
  }

  assertString(report.requestId, "requestId");
  assertNullableString(report.sessionId ?? null, "sessionId");

  if (!INTENT_ENUM.has(report.intent)) {
    throw new MoonMindError("Invalid intent", { field: "intent" });
  }

  assertString(report.query, "query");

  if (!report.entities || typeof report.entities !== "object") {
    throw new MoonMindError("Invalid entities", { field: "entities" });
  }
  assertNullableString(report.entities.githubUsername, "entities.githubUsername");
  assertNullableString(
    report.entities.leetcodeUsername,
    "entities.leetcodeUsername",
  );
  assertArray(report.entities.topics, "entities.topics");

  assertArray(report.dataSources, "dataSources");
  report.dataSources.forEach((source) => {
    if (!SOURCE_ENUM.has(source)) {
      throw new MoonMindError("Invalid data source", { field: "dataSources" });
    }
  });

  if (!report.constraints || typeof report.constraints !== "object") {
    throw new MoonMindError("Invalid constraints", { field: "constraints" });
  }
  assertNullableString(report.constraints.timeRange, "constraints.timeRange");
  if (
    report.constraints.limit !== null &&
    (!Number.isInteger(report.constraints.limit) ||
      report.constraints.limit < 1)
  ) {
    throw new MoonMindError("Invalid constraints.limit", {
      field: "constraints.limit",
    });
  }
  assertArray(report.constraints.fields, "constraints.fields");

  if (!report.response || typeof report.response !== "object") {
    throw new MoonMindError("Invalid response", { field: "response" });
  }
  if (!RESPONSE_MODE_ENUM.has(report.response.mode)) {
    throw new MoonMindError("Invalid response.mode", { field: "response.mode" });
  }
  if (!RESPONSE_FORMAT_ENUM.has(report.response.format)) {
    throw new MoonMindError("Invalid response.format", {
      field: "response.format",
    });
  }

  if (!report.safety || typeof report.safety !== "object") {
    throw new MoonMindError("Invalid safety", { field: "safety" });
  }
  assertBoolean(report.safety.outOfScope, "safety.outOfScope");
  assertArray(report.safety.reasons, "safety.reasons");

  if (typeof report.confidence !== "number") {
    throw new MoonMindError("Invalid confidence", { field: "confidence" });
  }
  if (report.confidence < 0 || report.confidence > 1) {
    throw new MoonMindError("Invalid confidence", { field: "confidence" });
  }

  return report;
}

module.exports = {
  assertValidIntentReport,
};
