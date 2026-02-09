const INTENT_REPORT_VERSION = "2.0";

const intentReportSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "requestId",
    "intentCategory",
    "intentSubtype",
    "query",
    "semanticQuery",
    "keywords",
    "filters",
    "entities",
    "dataSources",
    "constraints",
    "execution",
    "safety",
    "message",
    "confidence",
  ],
  properties: {
    version: { type: "string", const: INTENT_REPORT_VERSION },
    requestId: { type: "string", minLength: 1 },
    sessionId: { type: ["string", "null"] },
    intentCategory: {
      type: "string",
      enum: ["greeting", "question", "action"],
    },
    intentSubtype: {
      type: "string",
      enum: [
        "general_greeting",
        "factual",
        "credentials",
        "skills",
        "experiences",
        "strengths_weaknesses",
        "stats_github",
        "stats_leetcode",
        "unsupported",
        "fetch_documents",
        "summarize_aspect",
      ],
    },
    query: { type: "string", minLength: 1 },
    semanticQuery: { type: "string", minLength: 1 },
    keywords: {
      type: "array",
      items: { type: "string" },
    },
    filters: {
      type: "object",
      additionalProperties: false,
      required: ["topics", "documentTypes", "timeRange"],
      properties: {
        topics: {
          type: "array",
          items: { type: "string" },
        },
        documentTypes: {
          type: "array",
          items: { type: "string" },
        },
        timeRange: { type: ["string", "null"] },
      },
    },
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
        enum: ["mongo_github_stats", "leetcode_graphql", "mongo_vector_docs"],
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
    execution: {
      type: "object",
      additionalProperties: false,
      required: ["retrieval", "responseStyle", "allowLLM"],
      properties: {
        retrieval: {
          type: "string",
          enum: ["none", "full_search", "github_stats", "leetcode_stats"],
        },
        responseStyle: {
          type: "string",
          enum: ["greeting", "factual", "grounded", "denial", "documents", "summary"],
        },
        allowLLM: { type: "boolean" },
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
    message: { type: "string", maxLength: 240 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};

module.exports = {
  INTENT_REPORT_VERSION,
  intentReportSchema,
};
