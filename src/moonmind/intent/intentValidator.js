const { intentReportSchema } = require("./intentReportSchema");
const { MoonMindError } = require("../utils/errors");

const CATEGORY_ENUM = new Set(
  intentReportSchema.properties.intentCategory.enum,
);
const SUBTYPE_ENUM = new Set(intentReportSchema.properties.intentSubtype.enum);
const SOURCE_ENUM = new Set(intentReportSchema.properties.dataSources.items.enum);
const EXECUTION_RETRIEVAL_ENUM = new Set(
  intentReportSchema.properties.execution.properties.retrieval.enum,
);
const EXECUTION_RESPONSE_ENUM = new Set(
  intentReportSchema.properties.execution.properties.responseStyle.enum,
);

const SUBTYPE_BY_CATEGORY = {
  greeting: new Set(["general_greeting"]),
  question: new Set([
    "factual",
    "credentials",
    "skills",
    "experiences",
    "strengths_weaknesses",
    "stats_github",
    "stats_leetcode",
    "unsupported",
  ]),
  action: new Set(["fetch_documents", "summarize_aspect"]),
};

const RETRIEVAL_BY_SUBTYPE = {
  general_greeting: "none",
  factual: "none",
  credentials: "full_search",
  skills: "full_search",
  experiences: "full_search",
  strengths_weaknesses: "full_search",
  stats_github: "github_stats",
  stats_leetcode: "leetcode_stats",
  unsupported: "none",
  fetch_documents: "full_search",
  summarize_aspect: "full_search",
};

const RESPONSE_STYLE_BY_SUBTYPE = {
  general_greeting: "greeting",
  factual: "factual",
  credentials: "grounded",
  skills: "grounded",
  experiences: "grounded",
  strengths_weaknesses: "grounded",
  stats_github: "grounded",
  stats_leetcode: "grounded",
  unsupported: "denial",
  fetch_documents: "documents",
  summarize_aspect: "summary",
};

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

  if (!CATEGORY_ENUM.has(report.intentCategory)) {
    throw new MoonMindError("Invalid intentCategory", { field: "intentCategory" });
  }
  if (!SUBTYPE_ENUM.has(report.intentSubtype)) {
    throw new MoonMindError("Invalid intentSubtype", { field: "intentSubtype" });
  }
  const allowedSubtypes = SUBTYPE_BY_CATEGORY[report.intentCategory];
  if (!allowedSubtypes?.has(report.intentSubtype)) {
    throw new MoonMindError("intentSubtype does not match category", {
      field: "intentSubtype",
    });
  }

  assertString(report.query, "query");
  assertString(report.semanticQuery, "semanticQuery");
  assertArray(report.keywords, "keywords");

  if (!report.filters || typeof report.filters !== "object") {
    throw new MoonMindError("Invalid filters", { field: "filters" });
  }
  assertArray(report.filters.topics, "filters.topics");
  assertArray(report.filters.documentTypes, "filters.documentTypes");
  assertNullableString(report.filters.timeRange, "filters.timeRange");

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

  if (!report.execution || typeof report.execution !== "object") {
    throw new MoonMindError("Invalid execution", { field: "execution" });
  }
  if (!EXECUTION_RETRIEVAL_ENUM.has(report.execution.retrieval)) {
    throw new MoonMindError("Invalid execution.retrieval", {
      field: "execution.retrieval",
    });
  }
  if (!EXECUTION_RESPONSE_ENUM.has(report.execution.responseStyle)) {
    throw new MoonMindError("Invalid execution.responseStyle", {
      field: "execution.responseStyle",
    });
  }
  assertBoolean(report.execution.allowLLM, "execution.allowLLM");

  const expectedRetrieval = RETRIEVAL_BY_SUBTYPE[report.intentSubtype];
  if (expectedRetrieval !== report.execution.retrieval) {
    throw new MoonMindError("execution.retrieval mismatch", {
      field: "execution.retrieval",
    });
  }
  const expectedResponse = RESPONSE_STYLE_BY_SUBTYPE[report.intentSubtype];
  if (expectedResponse !== report.execution.responseStyle) {
    throw new MoonMindError("execution.responseStyle mismatch", {
      field: "execution.responseStyle",
    });
  }

  if (!report.safety || typeof report.safety !== "object") {
    throw new MoonMindError("Invalid safety", { field: "safety" });
  }
  assertBoolean(report.safety.outOfScope, "safety.outOfScope");
  assertArray(report.safety.reasons, "safety.reasons");

  if (report.intentSubtype === "unsupported") {
    if (report.safety.outOfScope && report.safety.reasons.length === 0) {
      throw new MoonMindError("Missing safety reasons", {
        field: "safety.reasons",
      });
    }
  } else {
    if (report.safety.outOfScope || report.safety.reasons.length > 0) {
      throw new MoonMindError("Unexpected safety flags", { field: "safety" });
    }
  }

  if (typeof report.message !== "string") {
    throw new MoonMindError("Invalid message", { field: "message" });
  }
  if (report.intentSubtype === "unsupported" && report.message.length === 0) {
    throw new MoonMindError("Message required for unsupported", {
      field: "message",
    });
  }
  if (report.intentSubtype !== "unsupported" && report.message.length > 0) {
    throw new MoonMindError("Message must be empty", { field: "message" });
  }

  if (typeof report.confidence !== "number") {
    throw new MoonMindError("Invalid confidence", { field: "confidence" });
  }
  if (report.confidence < 0 || report.confidence > 1) {
    throw new MoonMindError("Invalid confidence", { field: "confidence" });
  }

  const expectedSources = (() => {
    switch (report.execution.retrieval) {
      case "github_stats":
        return ["mongo_github_stats"];
      case "leetcode_stats":
        return ["leetcode_graphql"];
      case "full_search":
        return ["mongo_vector_docs"];
      case "none":
      default:
        return [];
    }
  })();

  if (report.dataSources.length !== expectedSources.length) {
    throw new MoonMindError("Invalid dataSources", { field: "dataSources" });
  }
  expectedSources.forEach((source) => {
    if (!report.dataSources.includes(source)) {
      throw new MoonMindError("Invalid dataSources", { field: "dataSources" });
    }
  });

  return report;
}

module.exports = {
  assertValidIntentReport,
};
