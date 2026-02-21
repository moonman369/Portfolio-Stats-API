const { createChatCompletion } = require("../adapters/openaiClient");
const { debugLog, serializeError } = require("../utils/debug");

const INTENT_MODEL = process.env.MOONMIND_INTENT_MODEL || "gpt-4o-mini";

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
    return JSON.parse(content);
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
};
