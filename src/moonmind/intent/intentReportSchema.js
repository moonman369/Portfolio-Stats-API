const PRIMARY_INTENTS = ["greeting", "question", "action", "chat"];
const QUESTION_SUBTYPES = [
  "factual",
  "portfolio_grounded",
  "portfolio_conceptual_hybrid",
  "stats",
  "unsupported",
];
const ACTION_SUBTYPES = [
  "fetch_documents",
  "summarize_aspect",
  "compare_aspects",
  "timeline_view",
  "count_items",
];
const CHAT_SUBTYPES = ["portfolio_exploration", "unsupported"];
const GREETING_SUBTYPES = ["standalone_greeting"];

const DOMAIN_ENUM = [
  "skills",
  "experience",
  "projects",
  "credentials",
  "certifications",
  "resume",
  "hobbies",
  "software development",
  "science",
  "technology topics",
  "github stats",
  "leetcode stats",
];

const intentReportSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "primary_intent",
    "subtype",
    "confidence",
    "modifiers",
    "is_in_scope",
    "out_of_scope_reason",
    "polite_redirect_message",
    "clarification_question",
    "domains",
    "filters",
    "boolean_logic",
    "aggregation",
    "logical_validity",
  ],
  properties: {
    primary_intent: { type: "string", enum: PRIMARY_INTENTS },
    subtype: {
      type: "string",
      enum: [
        ...QUESTION_SUBTYPES,
        ...ACTION_SUBTYPES,
        ...CHAT_SUBTYPES,
        ...GREETING_SUBTYPES,
      ],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    modifiers: {
      type: "object",
      additionalProperties: false,
      required: [
        "has_greeting_prefix",
        "requires_portfolio_grounding",
        "requires_conceptual_explanation",
        "is_comparison",
        "is_multi_domain",
        "requires_aggregation",
        "is_time_filtered",
        "is_ambiguous",
        "logical_conflict_detected",
      ],
      properties: {
        has_greeting_prefix: { type: "boolean" },
        requires_portfolio_grounding: { type: "boolean" },
        requires_conceptual_explanation: { type: "boolean" },
        is_comparison: { type: "boolean" },
        is_multi_domain: { type: "boolean" },
        requires_aggregation: { type: "boolean" },
        is_time_filtered: { type: "boolean" },
        is_ambiguous: { type: "boolean" },
        logical_conflict_detected: { type: "boolean" },
      },
    },
    is_in_scope: { type: "boolean" },
    out_of_scope_reason: { type: ["string", "null"] },
    polite_redirect_message: { type: ["string", "null"] },
    clarification_question: { type: ["string", "null"] },
    domains: {
      type: "array",
      items: { type: "string", enum: DOMAIN_ENUM },
    },
    filters: {
      type: "object",
      additionalProperties: false,
      required: ["metadata_filters", "keyword_filters", "exclusions"],
      properties: {
        metadata_filters: {
          type: "array",
          items: { type: "string" },
        },
        keyword_filters: {
          type: "array",
          items: { type: "string" },
        },
        exclusions: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    boolean_logic: {
      type: "object",
      additionalProperties: false,
      required: ["operator", "negations"],
      properties: {
        operator: { type: ["string", "null"], enum: ["AND", "OR", null] },
        negations: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    aggregation: {
      type: "object",
      additionalProperties: false,
      required: ["type", "group_by_field", "sort"],
      properties: {
        type: {
          type: "string",
          enum: ["none", "compare", "timeline", "group_by", "count"],
        },
        group_by_field: { type: ["string", "null"] },
        sort: {
          type: "object",
          additionalProperties: false,
          required: ["field", "order"],
          properties: {
            field: { type: ["string", "null"] },
            order: { type: ["string", "null"], enum: ["asc", "desc", null] },
          },
        },
      },
    },
    logical_validity: {
      type: "object",
      additionalProperties: false,
      required: ["is_consistent", "conflicts"],
      properties: {
        is_consistent: { type: "boolean" },
        conflicts: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
};

module.exports = {
  PRIMARY_INTENTS,
  QUESTION_SUBTYPES,
  ACTION_SUBTYPES,
  CHAT_SUBTYPES,
  GREETING_SUBTYPES,
  DOMAIN_ENUM,
  intentReportSchema,
};
