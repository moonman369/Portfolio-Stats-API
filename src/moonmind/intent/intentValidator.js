const {
  PRIMARY_INTENTS,
  QUESTION_SUBTYPES,
  ACTION_SUBTYPES,
  CHAT_SUBTYPES,
  GREETING_SUBTYPES,
  DOMAIN_ENUM,
} = require("./intentReportSchema");
const { MoonMindError } = require("../utils/errors");

const TOP_LEVEL_KEYS = [
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
];

const MODIFIER_KEYS = [
  "has_greeting_prefix",
  "requires_portfolio_grounding",
  "requires_conceptual_explanation",
  "is_comparison",
  "is_multi_domain",
  "requires_aggregation",
  "is_time_filtered",
  "is_ambiguous",
  "logical_conflict_detected",
];

function assertExactKeys(obj, keys, field) {
  const actual = Object.keys(obj || {});
  if (actual.length !== keys.length || keys.some((key) => !actual.includes(key))) {
    throw new MoonMindError(`Invalid ${field} keys`, { field });
  }
}

function assertType(value, type, field) {
  if (typeof value !== type) {
    throw new MoonMindError(`Invalid ${field}`, { field });
  }
}

function assertStringOrNull(value, field) {
  if (value !== null && typeof value !== "string") {
    throw new MoonMindError(`Invalid ${field}`, { field });
  }
}

function assertArray(value, field) {
  if (!Array.isArray(value)) {
    throw new MoonMindError(`Invalid ${field}`, { field });
  }
}

function assertBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw new MoonMindError(`Invalid ${field}`, { field });
  }
}

function assertSubtype(primaryIntent, subtype) {
  if (primaryIntent === "greeting" && !GREETING_SUBTYPES.includes(subtype)) {
    throw new MoonMindError("Invalid subtype for greeting", { field: "subtype" });
  }
  if (primaryIntent === "question" && !QUESTION_SUBTYPES.includes(subtype)) {
    throw new MoonMindError("Invalid subtype for question", { field: "subtype" });
  }
  if (primaryIntent === "action" && !ACTION_SUBTYPES.includes(subtype)) {
    throw new MoonMindError("Invalid subtype for action", { field: "subtype" });
  }
  if (primaryIntent === "chat" && !CHAT_SUBTYPES.includes(subtype)) {
    throw new MoonMindError("Invalid subtype for chat", { field: "subtype" });
  }
}

function assertValidIntentReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw new MoonMindError("Intent report validation failed", { field: "root" });
  }

  assertExactKeys(report, TOP_LEVEL_KEYS, "root");

  if (!PRIMARY_INTENTS.includes(report.primary_intent)) {
    throw new MoonMindError("Invalid primary_intent", { field: "primary_intent" });
  }
  assertType(report.subtype, "string", "subtype");
  assertSubtype(report.primary_intent, report.subtype);

  assertType(report.confidence, "number", "confidence");
  if (report.confidence < 0 || report.confidence > 1) {
    throw new MoonMindError("Invalid confidence range", { field: "confidence" });
  }

  if (!report.modifiers || typeof report.modifiers !== "object") {
    throw new MoonMindError("Invalid modifiers", { field: "modifiers" });
  }
  assertExactKeys(report.modifiers, MODIFIER_KEYS, "modifiers");
  MODIFIER_KEYS.forEach((key) => assertBoolean(report.modifiers[key], `modifiers.${key}`));

  assertBoolean(report.is_in_scope, "is_in_scope");
  assertStringOrNull(report.out_of_scope_reason, "out_of_scope_reason");
  assertStringOrNull(report.polite_redirect_message, "polite_redirect_message");
  assertStringOrNull(report.clarification_question, "clarification_question");

  assertArray(report.domains, "domains");
  report.domains.forEach((domain) => {
    if (typeof domain !== "string" || !DOMAIN_ENUM.includes(domain)) {
      throw new MoonMindError("Invalid domain", { field: "domains" });
    }
  });

  if (!report.filters || typeof report.filters !== "object") {
    throw new MoonMindError("Invalid filters", { field: "filters" });
  }
  assertExactKeys(report.filters, ["metadata_filters", "keyword_filters", "exclusions"], "filters");
  assertArray(report.filters.metadata_filters, "filters.metadata_filters");
  assertArray(report.filters.keyword_filters, "filters.keyword_filters");
  assertArray(report.filters.exclusions, "filters.exclusions");

  if (!report.boolean_logic || typeof report.boolean_logic !== "object") {
    throw new MoonMindError("Invalid boolean_logic", { field: "boolean_logic" });
  }
  assertExactKeys(report.boolean_logic, ["operator", "negations"], "boolean_logic");
  if (!["AND", "OR", null].includes(report.boolean_logic.operator)) {
    throw new MoonMindError("Invalid boolean_logic.operator", { field: "boolean_logic.operator" });
  }
  assertArray(report.boolean_logic.negations, "boolean_logic.negations");

  if (!report.aggregation || typeof report.aggregation !== "object") {
    throw new MoonMindError("Invalid aggregation", { field: "aggregation" });
  }
  assertExactKeys(report.aggregation, ["type", "group_by_field", "sort"], "aggregation");
  if (!["none", "compare", "timeline", "group_by", "count"].includes(report.aggregation.type)) {
    throw new MoonMindError("Invalid aggregation.type", { field: "aggregation.type" });
  }
  assertStringOrNull(report.aggregation.group_by_field, "aggregation.group_by_field");
  if (!report.aggregation.sort || typeof report.aggregation.sort !== "object") {
    throw new MoonMindError("Invalid aggregation.sort", { field: "aggregation.sort" });
  }
  assertExactKeys(report.aggregation.sort, ["field", "order"], "aggregation.sort");
  assertStringOrNull(report.aggregation.sort.field, "aggregation.sort.field");
  if (!["asc", "desc", null].includes(report.aggregation.sort.order)) {
    throw new MoonMindError("Invalid aggregation.sort.order", { field: "aggregation.sort.order" });
  }

  if (!report.logical_validity || typeof report.logical_validity !== "object") {
    throw new MoonMindError("Invalid logical_validity", { field: "logical_validity" });
  }
  assertExactKeys(report.logical_validity, ["is_consistent", "conflicts"], "logical_validity");
  assertBoolean(report.logical_validity.is_consistent, "logical_validity.is_consistent");
  assertArray(report.logical_validity.conflicts, "logical_validity.conflicts");

  if (!report.is_in_scope) {
    if (!report.out_of_scope_reason || !report.polite_redirect_message) {
      throw new MoonMindError("Out of scope responses require reason and redirect", {
        field: "is_in_scope",
      });
    }
  } else if (report.out_of_scope_reason !== null || report.polite_redirect_message !== null) {
    throw new MoonMindError("In-scope responses must not include out-of-scope payload", {
      field: "is_in_scope",
    });
  }

  if (report.confidence < 0.6) {
    if (!report.modifiers.is_ambiguous || !report.clarification_question) {
      throw new MoonMindError("Ambiguous reports must include clarification question", {
        field: "clarification_question",
      });
    }
  } else if (report.modifiers.is_ambiguous && !report.clarification_question) {
    throw new MoonMindError("Ambiguous flag requires clarification question", {
      field: "clarification_question",
    });
  }

  if (!report.logical_validity.is_consistent) {
    if (!report.modifiers.logical_conflict_detected) {
      throw new MoonMindError("Conflict flag required for inconsistent reports", {
        field: "modifiers.logical_conflict_detected",
      });
    }
    if (report.logical_validity.conflicts.length === 0) {
      throw new MoonMindError("Conflicts required when inconsistent", {
        field: "logical_validity.conflicts",
      });
    }
  }

  return report;
}

function getExecutionDirective(report) {
  if (!report.is_in_scope) {
    return { mode: "redirect", retrieval: "none" };
  }
  if (!report.logical_validity.is_consistent) {
    return { mode: "conflict", retrieval: "none" };
  }
  if (report.modifiers.is_ambiguous) {
    return { mode: "clarification", retrieval: "none" };
  }
  if (report.primary_intent === "greeting") {
    return { mode: "greeting", retrieval: "none" };
  }
  if (report.primary_intent === "question") {
    if (report.subtype === "factual") {
      return { mode: "factual", retrieval: "none" };
    }
    if (report.subtype === "unsupported") {
      return { mode: "unsupported", retrieval: "none" };
    }
    if (report.subtype === "stats") {
      const isLeetcode = report.domains.includes("leetcode stats");
      return { mode: "stats", retrieval: isLeetcode ? "leetcode_stats" : "github_stats" };
    }
    return { mode: "grounded", retrieval: "full_search" };
  }
  if (report.primary_intent === "action") {
    return { mode: report.subtype, retrieval: "full_search" };
  }
  if (report.primary_intent === "chat") {
    if (report.subtype === "unsupported") {
      return { mode: "unsupported", retrieval: "none" };
    }
    return { mode: "chat", retrieval: "full_search" };
  }
  throw new MoonMindError("Unable to derive execution directive", {
    field: "primary_intent",
  });
}

module.exports = {
  assertValidIntentReport,
  getExecutionDirective,
};
