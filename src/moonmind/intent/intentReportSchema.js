const INTENT_REPORT_VERSION = "1.0";

const intentReportSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "requestId",
    "intent",
    "query",
    "entities",
    "dataSources",
    "constraints",
    "response",
    "safety",
    "confidence",
  ],
  properties: {
    version: { type: "string", const: INTENT_REPORT_VERSION },
    requestId: { type: "string", minLength: 1 },
    sessionId: { type: ["string", "null"] },
    intent: {
      type: "string",
      enum: [
        "github_stats",
        "leetcode_stats",
        "portfolio_docs",
        "capabilities",
        "out_of_scope",
        "unknown",
      ],
    },
    query: { type: "string", minLength: 1 },
    entities: {
      type: "object",
      additionalProperties: false,
      properties: {
        githubUsername: { type: ["string", "null"] },
        leetcodeUsername: { type: ["string", "null"] },
        topics: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["githubUsername", "leetcodeUsername", "topics"],
    },
    dataSources: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "mongo_github_stats",
          "leetcode_graphql",
          "mongo_vector_docs",
        ],
      },
    },
    constraints: {
      type: "object",
      additionalProperties: false,
      properties: {
        timeRange: { type: ["string", "null"] },
        limit: { type: ["integer", "null"], minimum: 1 },
        fields: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["timeRange", "limit", "fields"],
    },
    response: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "format"],
      properties: {
        mode: { type: "string", enum: ["raw", "grounded", "unknown"] },
        format: { type: "string", enum: ["json", "text"] },
      },
    },
    safety: {
      type: "object",
      additionalProperties: false,
      required: ["outOfScope", "reasons"],
      properties: {
        outOfScope: { type: "boolean" },
        reasons: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

module.exports = {
  INTENT_REPORT_VERSION,
  intentReportSchema,
};
