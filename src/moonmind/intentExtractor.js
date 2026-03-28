const { createChatCompletion } = require("./adapters/openaiClient");
const { debugLog, serializeError } = require("./utils/debug");

const INTENT_MODEL = process.env.MOONMIND_INTENT_MODEL || "gpt-4o-mini";

const DEFAULT_INTENT_PAYLOAD = {
  intent: "question",
  retrieval_plan: {
    semantic: true,
    keyword: false,
    metadata: false,
  },
  entities: {
    skills: [],
    projects: [],
    certifications: [],
    organizations: [],
    dates: {
      from: null,
      to: null,
    },
  },
  filters: {
    domain: [],
    time_range: null,
  },
};

const VALID_INTENTS = new Set(["question", "greeting", "chat"]);

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeDateRange(value) {
  if (!value || typeof value !== "object") {
    return { from: null, to: null };
  }

  return {
    from:
      typeof value.from === "string" && value.from.trim()
        ? value.from.trim()
        : null,
    to:
      typeof value.to === "string" && value.to.trim() ? value.to.trim() : null,
  };
}

function normalizeIntentPayload(payload) {
  const normalized = {
    intent: VALID_INTENTS.has(payload?.intent)
      ? payload.intent
      : DEFAULT_INTENT_PAYLOAD.intent,
    retrieval_plan: {
      semantic:
        typeof payload?.retrieval_plan?.semantic === "boolean"
          ? payload.retrieval_plan.semantic
          : true,
      keyword:
        typeof payload?.retrieval_plan?.keyword === "boolean"
          ? payload.retrieval_plan.keyword
          : false,
      metadata:
        typeof payload?.retrieval_plan?.metadata === "boolean"
          ? payload.retrieval_plan.metadata
          : false,
    },
    entities: {
      skills: normalizeStringArray(payload?.entities?.skills),
      projects: normalizeStringArray(payload?.entities?.projects),
      certifications: normalizeStringArray(payload?.entities?.certifications),
      organizations: normalizeStringArray(payload?.entities?.organizations),
      dates: normalizeDateRange(payload?.entities?.dates),
    },
    filters: {
      domain: normalizeStringArray(payload?.filters?.domain),
      time_range:
        typeof payload?.filters?.time_range === "string" &&
        payload.filters.time_range.trim()
          ? payload.filters.time_range.trim()
          : null,
    },
  };

  if (
    !normalized.retrieval_plan.semantic &&
    !normalized.retrieval_plan.keyword &&
    !normalized.retrieval_plan.metadata
  ) {
    normalized.retrieval_plan.semantic = normalized.intent === "question";
  }

  return normalized;
}

function buildIntentMessages(query) {
  return [
    {
      role: "system",
      content: [
        "You extract MoonMind intent and retrieval instructions.",
        "Return valid JSON only.",
        "No markdown, no prose, no explanation.",
        "Intent must be exactly one of: question, greeting, chat.",
        "retrieval_plan must always be explicit with boolean semantic, keyword, and metadata fields.",
        "If unsure, set retrieval_plan.semantic to true.",
        "entities fields must always exist.",
        "filters fields must always exist.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "Analyze this user query and return JSON with this exact shape:",
        JSON.stringify(DEFAULT_INTENT_PAYLOAD, null, 2),
        "User query:",
        query,
      ].join("\n"),
    },
  ];
}

async function extractIntent({ query, requestId, sessionId }) {
  debugLog("moonmind.intent.start", {
    requestId,
    sessionId: sessionId ?? null,
    query,
  });

  const completion = await createChatCompletion({
    model: INTENT_MODEL,
    messages: buildIntentMessages(query),
    responseFormat: { type: "json_object" },
    temperature: 0,
  });

  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("MoonMind intent extractor returned empty content");
  }

  try {
    const parsed = JSON.parse(content);
    const normalized = normalizeIntentPayload(parsed);

    debugLog("moonmind.intent.extracted", {
      requestId,
      intent: normalized.intent,
      retrieval_plan: normalized.retrieval_plan,
      entities: normalized.entities,
      filters: normalized.filters,
    });

    return normalized;
  } catch (error) {
    debugLog("moonmind.intent.parse_error", {
      requestId,
      error: serializeError(error),
      contentPreview: content.slice(0, 500),
    });
    throw error;
  }
}

module.exports = {
  DEFAULT_INTENT_PAYLOAD,
  normalizeIntentPayload,
  extractIntent,
};
