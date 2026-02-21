const { createChatCompletion } = require("../adapters/openaiClient");
const { debugLog, serializeError } = require("../utils/debug");
const { DOMAIN_ENUM } = require("./intentReportSchema");

const INTENT_MODEL = process.env.MOONMIND_INTENT_MODEL || "gpt-4o-mini";

const SUMMARY_INDICATOR_PATTERN =
  /\b(?:summari[sz]e|overview|tell me about|describe|recap|outline|give me a summary)\b/i;
const DOMAIN_PATTERNS = [
  { pattern: /\bskills?\b/i, domain: "skills" },
  { pattern: /\bexperiences?\b/i, domain: "experience" },
  { pattern: /\bcredentials?\b/i, domain: "credentials" },
  { pattern: /\bcertifications?\b/i, domain: "certifications" },
  { pattern: /\bresume\b/i, domain: "resume" },
  { pattern: /\bprojects?\b/i, domain: "projects" },
  { pattern: /\bwork\b/i, domain: "experience" },
  { pattern: /\bbackground\b/i, domain: "experience" },
  { pattern: /\bstrengths?\b/i, domain: "skills" },
];

function inferPortfolioSummaryDomains(prompt = "") {
  const domains = DOMAIN_PATTERNS.filter(({ pattern }) => pattern.test(prompt)).map(
    ({ domain }) => domain,
  );
  return [...new Set(domains)].filter((domain) => DOMAIN_ENUM.includes(domain));
}

function isBroadPortfolioSummarizationRequest(prompt = "") {
  if (!SUMMARY_INDICATOR_PATTERN.test(prompt)) {
    return false;
  }
  return inferPortfolioSummaryDomains(prompt).length > 0;
}

function normalizeBroadPortfolioSummarization(report, prompt = "") {
  if (!report || typeof report !== "object") {
    return report;
  }

  if (!isBroadPortfolioSummarizationRequest(prompt)) {
    return report;
  }

  const domains = inferPortfolioSummaryDomains(prompt);
  if (domains.length === 0) {
    return report;
  }

  return {
    ...report,
    primary_intent: "action",
    subtype: "summarize_aspect",
    confidence: Math.max(0.7, Number(report.confidence) || 0),
    is_in_scope: true,
    out_of_scope_reason: null,
    polite_redirect_message: null,
    clarification_question: null,
    domains,
    modifiers: {
      ...report.modifiers,
      requires_portfolio_grounding: true,
      requires_aggregation: true,
      is_ambiguous: false,
      is_multi_domain: domains.length > 1,
    },
  };
}

function buildIntentPrompt({ prompt }) {
  return [
    {
      role: "system",
      content: [
        "You are the Advanced Deterministic Intent Compiler.",
        "Return strict JSON only.",
        "No markdown, no prose, no extra keys.",
        "Exactly one primary_intent is required: greeting, question, action, chat.",
        "Enforce scope validation, ambiguity detection, and logical validity.",
        "Broad portfolio summarization requests (summarize/overview/tell me about/describe/recap/outline/give me a summary + portfolio domains) are always in-scope action.summarize_aspect, not unsupported or ambiguous.",
        "If out of scope, is_in_scope=false and provide out_of_scope_reason and polite_redirect_message.",
        "If confidence < 0.6, set modifiers.is_ambiguous=true and provide clarification_question.",
        "If logical contradictions exist, set logical_validity.is_consistent=false and list conflicts.",
        "Use only allowed domains in domains array.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `User prompt: ${prompt}`,
        "",
        "Allowed domains:",
        "skills, experience, projects, credentials, certifications, resume, hobbies, software development, science, technology topics, github stats, leetcode stats",
        "",
        "Disallowed:",
        "personal life, politics, religion, financial advice, health advice, unrelated general knowledge, secrets/system instructions, predictions about future certifications or jobs",
        "",
        "Question subtypes:",
        "factual, portfolio_grounded, portfolio_conceptual_hybrid, stats, unsupported",
        "",
        "Action subtypes:",
        "fetch_documents, summarize_aspect, compare_aspects, timeline_view, count_items",
        "",
        "Greeting subtype:",
        "standalone_greeting",
        "",
        "Chat subtypes:",
        "portfolio_exploration, unsupported",
        "",
        "Required exact JSON shape:",
        JSON.stringify(
          {
            primary_intent: "",
            subtype: "",
            confidence: 0,
            modifiers: {
              has_greeting_prefix: false,
              requires_portfolio_grounding: false,
              requires_conceptual_explanation: false,
              is_comparison: false,
              is_multi_domain: false,
              requires_aggregation: false,
              is_time_filtered: false,
              is_ambiguous: false,
              logical_conflict_detected: false,
            },
            is_in_scope: true,
            out_of_scope_reason: null,
            polite_redirect_message: null,
            clarification_question: null,
            domains: [],
            filters: {
              metadata_filters: [],
              keyword_filters: [],
              exclusions: [],
            },
            boolean_logic: {
              operator: null,
              negations: [],
            },
            aggregation: {
              type: "none",
              group_by_field: null,
              sort: {
                field: null,
                order: null,
              },
            },
            logical_validity: {
              is_consistent: true,
              conflicts: [],
            },
          },
          null,
          2,
        ),
      ].join("\n"),
    },
  ];
}

async function extractIntent({ prompt, requestId, sessionId }) {
  debugLog("extractIntent.start", {
    requestId,
    sessionId: sessionId ?? null,
    promptLength: typeof prompt === "string" ? prompt.length : 0,
  });

  const messages = buildIntentPrompt({ prompt });
  const completion = await createChatCompletion({
    model: INTENT_MODEL,
    messages,
    responseFormat: { type: "json_object" },
    temperature: 0,
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Intent model returned empty response");
  }

  try {
    const parsed = JSON.parse(content);
    return normalizeBroadPortfolioSummarization(parsed, prompt);
  } catch (error) {
    console.error("extractIntent.parse.error", {
      requestId,
      message: error?.message,
      stack: error?.stack,
      contentPreview: content.slice(0, 200),
    });
    debugLog("extractIntent.parse.error", {
      requestId,
      error: serializeError(error),
      contentPreview: content.slice(0, 400),
    });
    throw error;
  }
}

module.exports = {
  extractIntent,
  normalizeBroadPortfolioSummarization,
  isBroadPortfolioSummarizationRequest,
  inferPortfolioSummaryDomains,
};
