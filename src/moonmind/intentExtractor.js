const { createChatCompletion } = require("./adapters/openaiClient");
const { debugLog, serializeError } = require("./utils/debug");
const VECTOR_CONFIG = require("../../config/vectorConfig");

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
  domain: null,
  subcategories: [],
  requires_retrieval: true,
  filters: {
    domain: [],
    time_range: null,
  },
};

const VALID_INTENTS = new Set(["question", "greeting", "chat"]);
const SUBCATEGORY_SET = new Set(VECTOR_CONFIG.ALLOWED_SUBCATEGORIES);
const DOMAIN_RULES = [
  { pattern: /\bskills?\b|\btech\s*stack\b|\bstrengths?\b/i, domain: "skills" },
  { pattern: /\bprojects?\b|\bbuild\b|\bimplemented\b/i, domain: "projects" },
  { pattern: /\bexperiences?\b|\bwork\b|\brole\b/i, domain: "experience" },
  {
    pattern: /\bprofile\b|\boverall\s+summary\b|\babout\s+me\b/i,
    domain: "profile",
  },
  { pattern: /\bcertifications?\b|\bcertified\b/i, domain: "certifications" },
  { pattern: /\beducation\b|\bdegree\b|\buniversity\b/i, domain: "education" },
  {
    pattern: /\bachievements?\b|\bawards?\b|\branking\b/i,
    domain: "achievements",
  },
  {
    pattern: /\bresearch\b|\bpaper\b|\bpublication\b|\bnlp\b/i,
    domain: "research",
  },
  {
    pattern: /\bhobbies?\b|\binterests?\b|\bgaming\b|\bwriting\b/i,
    domain: "hobbies",
  },
];

const SUBCATEGORY_RULES = [
  ["backend", /\bbackend\b|\bnode\b|\bexpress\b/i],
  ["frontend", /\bfrontend\b|\breact\b|\bui\b/i],
  ["database", /\bmongodb\b|\bpostgres\b|\bdatabase\b/i],
  ["devops", /\bdevops\b|\bci\/cd\b|\bdocker\b/i],
  ["cloud", /\bcloud\b|\baws\b|\bazure\b|\bgcp\b/i],
  ["api", /\bapi\b/],
  ["api-design", /\bapi\s*design\b/i],
  ["system-design", /\bsystem\s*design\b/i],
  ["distributed-systems", /\bdistributed\b|\bmicroservices\b/i],
  ["machine-learning", /\bmachine\s*learning\b|\bml\b/i],
  ["generative-ai", /\bgenerative\s*ai\b|\bllm\b/i],
  ["rag", /\brag\b|\bretrieval[-\s]*augmented\b/i],
  ["vector-databases", /\bvector\s*db\b|\bvector\s*database\b/i],
  ["ai", /\bai\b|\bartificial\s*intelligence\b/i],
  ["search", /\bsearch\b|\bretriev\w*\b/i],
  ["scalable", /\bscalable\b|\bscale\b/i],
  ["high-performance", /\bhigh[-\s]*performance\b|\blatency\b/i],
  ["algorithms", /\balgorithm\w*\b/i],
  ["competitive-programming", /\bcompetitive\s*programming\b|\bleetcode\b/i],
  ["technical", /\btechnical\b/i],
  ["learning", /\blearning\b/i],
];

const GREETING_ONLY_PATTERN =
  /^\s*(?:hi|hello|hey|yo|good\s+(?:morning|afternoon|evening))(?:[\s,!.\-]+(?:there|ayan|moonmind|team))?[\s!,.?]*$/i;
const CASUAL_ONLY_PATTERN =
  /^\s*(?:how are you|what'?s up|thanks|thank you)[\s!,.?]*$/i;
const META_ONLY_PATTERN =
  /^\s*(?:who are you|what can you do|tell me about yourself|what is your role|show (?:the )?system prompt)[\s!,.?]*$/i;

function hasAnyRetrievalStrategy(retrievalPlan = {}) {
  return Boolean(
    retrievalPlan.semantic || retrievalPlan.keyword || retrievalPlan.metadata,
  );
}

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

function inferDeterministicIntentTaxonomy(query) {
  const normalizedQuery = String(query || "").trim();

  const isGreetingOnly = GREETING_ONLY_PATTERN.test(normalizedQuery);
  const isCasualOnly = CASUAL_ONLY_PATTERN.test(normalizedQuery);
  const isMetaOnly = META_ONLY_PATTERN.test(normalizedQuery);

  const domain =
    DOMAIN_RULES.find(({ pattern }) => pattern.test(normalizedQuery))?.domain ||
    null;
  const subcategories = SUBCATEGORY_RULES.filter(([, pattern]) =>
    pattern.test(normalizedQuery),
  ).map(([subcategory]) => subcategory);

  const requiresRetrieval = !(isGreetingOnly || isCasualOnly || isMetaOnly);

  return {
    domain,
    subcategories: [...new Set(subcategories)].filter((value) =>
      SUBCATEGORY_SET.has(value),
    ),
    requires_retrieval: requiresRetrieval,
  };
}

function normalizeIntentTaxonomy(payload) {
  const domainCandidate =
    typeof payload?.domain === "string" ? payload.domain.trim() : null;
  const domain = VECTOR_CONFIG.ALLOWED_DOMAINS.includes(domainCandidate)
    ? domainCandidate
    : null;

  const subcategories = normalizeStringArray(payload?.subcategories).filter(
    (value) => SUBCATEGORY_SET.has(value),
  );

  const requiresRetrieval =
    typeof payload?.requires_retrieval === "boolean"
      ? payload.requires_retrieval
      : DEFAULT_INTENT_PAYLOAD.requires_retrieval;

  return {
    domain,
    subcategories,
    requires_retrieval: requiresRetrieval,
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
    ...normalizeIntentTaxonomy(payload),
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
    normalized.requires_retrieval &&
    !hasAnyRetrievalStrategy(normalized.retrieval_plan)
  ) {
    normalized.retrieval_plan.semantic = true;
  }

  if (!normalized.requires_retrieval) {
    normalized.retrieval_plan.semantic = false;
    normalized.retrieval_plan.keyword = false;
    normalized.retrieval_plan.metadata = false;
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
        "Set requires_retrieval false only for greeting-only/casual-only/meta-only messages with no portfolio question.",
        "If greeting words appear with an actual question/request, requires_retrieval must be true.",
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

function buildTaxonomyMessages(query) {
  return [
    {
      role: "system",
      content: [
        "Return only valid JSON with exactly these keys: domain, subcategories, requires_retrieval.",
        `domain must be one of ${JSON.stringify(VECTOR_CONFIG.ALLOWED_DOMAINS)} or null.`,
        `subcategories must contain only values from ${JSON.stringify(VECTOR_CONFIG.ALLOWED_SUBCATEGORIES)}.`,
        "requires_retrieval is boolean.",
        "No extra keys. No explanations.",
        "If unsure, return domain null, empty subcategories, requires_retrieval true.",
      ].join(" "),
    },
    {
      role: "user",
      content: query,
    },
  ];
}

async function extractTaxonomyIntentWithLLM(query) {
  const completion = await createChatCompletion({
    model: INTENT_MODEL,
    messages: buildTaxonomyMessages(query),
    responseFormat: { type: "json_object" },
    temperature: 0,
  });

  const content = completion?.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  try {
    return normalizeIntentTaxonomy(JSON.parse(content));
  } catch {
    return null;
  }
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
    const deterministicTaxonomy = inferDeterministicIntentTaxonomy(query);
    let taxonomy = deterministicTaxonomy;

    if (!taxonomy.domain && taxonomy.subcategories.length === 0) {
      const llmTaxonomy = await extractTaxonomyIntentWithLLM(query);
      if (llmTaxonomy) {
        taxonomy = llmTaxonomy;
      }
    }

    normalized.domain = taxonomy.domain;
    normalized.subcategories = taxonomy.subcategories;
    normalized.requires_retrieval = taxonomy.requires_retrieval;

    if (
      normalized.requires_retrieval &&
      !hasAnyRetrievalStrategy(normalized.retrieval_plan)
    ) {
      normalized.retrieval_plan.semantic = true;
    }

    if (!normalized.requires_retrieval) {
      normalized.retrieval_plan.semantic = false;
      normalized.retrieval_plan.keyword = false;
      normalized.retrieval_plan.metadata = false;
    }

    if (
      normalized.domain &&
      !normalized.filters.domain.includes(normalized.domain)
    ) {
      normalized.filters.domain = [
        ...normalized.filters.domain,
        normalized.domain,
      ];
    }

    debugLog("moonmind.intent.classification", {
      requestId,
      intent: normalized.intent,
      domain: normalized.domain,
      subcategories: normalized.subcategories,
      requires_retrieval: normalized.requires_retrieval,
      retrieval_plan: normalized.retrieval_plan,
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
  normalizeIntentTaxonomy,
  inferDeterministicIntentTaxonomy,
  extractIntent,
};
