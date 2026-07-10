"use strict";

function parseSentenceBound(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseBooleanFlag(value, fallback = true) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseUnitFloat(value, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }

  return parsed;
}

const SUMMARY_MIN_SENTENCES = parseSentenceBound(
  process.env.MOONMIND_SUMMARY_MIN_SENTENCES,
  3,
);
const SUMMARY_MAX_SENTENCES = Math.max(
  SUMMARY_MIN_SENTENCES,
  parseSentenceBound(process.env.MOONMIND_SUMMARY_MAX_SENTENCES, 6),
);
const ENFORCE_SUMMARY_SENTENCE_RANGE = parseBooleanFlag(
  process.env.MOONMIND_ENFORCE_SUMMARY_SENTENCE_RANGE,
  true,
);

// Required env vars for the autoEmbed vector setup. New names take precedence;
// the old MOONMIND_* names are honored as fallbacks so existing deploys keep
// working. `validateRequiredConfig()` fails startup when none of a group is set.
const REQUIRED_ENV_VARS = Object.freeze([
  { key: "MONGODB_URI", fallbacks: ["MONGO_URI"] },
  { key: "VECTOR_COLLECTION_NAME", fallbacks: ["MOONMIND_VECTOR_COLLECTION"] },
  {
    key: "VECTOR_INDEX_NAME",
    fallbacks: ["MOONMIND_VECTOR_INDEX", "MOONMIND_VECTOR_INDEX_NAME"],
  },
  { key: "VECTOR_TEXT_FIELD_PATH", fallbacks: [] },
  { key: "EMBEDDING_MODEL_NAME", fallbacks: [] },
]);

function readEnv(key, fallbacks = []) {
  for (const name of [key, ...fallbacks]) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function validateRequiredConfig() {
  const missing = REQUIRED_ENV_VARS.filter(
    ({ key, fallbacks }) => readEnv(key, fallbacks) === undefined,
  ).map(({ key, fallbacks }) =>
    fallbacks.length > 0 ? `${key} (or legacy ${fallbacks.join(" / ")})` : key,
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "See .env.example for descriptions and placeholder values.",
    );
  }
}

const VECTOR_CONFIG = Object.freeze({
  validateRequiredConfig,
  DB_NAME:
    readEnv("MONGODB_DB_NAME", ["MOONMIND_DB_NAME"]) || "portfolio-stats-api",
  DOCUMENT_COLLECTION: readEnv("VECTOR_COLLECTION_NAME", [
    "MOONMIND_VECTOR_COLLECTION",
  ]),
  METADATA_INDEX_COLLECTION:
    process.env.MOONMIND_METADATA_COLLECTION || "moonmindMetadataIndex",
  // Atlas autoEmbed model (e.g. voyage-4). Only used for the `model` option in
  // $vectorSearch and for logging/health info — the app never embeds anything.
  EMBEDDING_MODEL: readEnv("EMBEDDING_MODEL_NAME"),
  VECTOR_INDEX_NAME: readEnv("VECTOR_INDEX_NAME", [
    "MOONMIND_VECTOR_INDEX",
    "MOONMIND_VECTOR_INDEX_NAME",
  ]),
  // The text field(s) the autoEmbed index embeds. Comma-separated when the
  // index auto-embeds several fields — $vectorSearch takes a single `path`, so
  // retrieval runs one search per field and merges by best score.
  VECTOR_TEXT_FIELD_PATHS: (readEnv("VECTOR_TEXT_FIELD_PATH") || "")
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean),
  MAX_SUMMARY_CHARACTERS: 4000,
  SUMMARY_MIN_SENTENCES,
  SUMMARY_MAX_SENTENCES,
  ENFORCE_SUMMARY_SENTENCE_RANGE,
  // --- Retrieval tuning ---------------------------------------------------
  // How many ANN candidates the $vectorSearch stage scans before applying the
  // limit. Higher = better recall, slightly more latency. Only affects recall,
  // never correctness, so it is safe to raise.
  VECTOR_NUM_CANDIDATES: parsePositiveInt(
    readEnv("VECTOR_NUM_CANDIDATES", ["MOONMIND_VECTOR_NUM_CANDIDATES"]),
    150,
  ),
  // Default $vectorSearch result limit (per retrieval arm). The pipeline may
  // still request more for wide candidate pools.
  VECTOR_SEARCH_LIMIT: parsePositiveInt(process.env.VECTOR_SEARCH_LIMIT, 10),
  // Reciprocal Rank Fusion constant. Standard default is 60; larger values
  // flatten the contribution of top ranks across arms.
  RRF_K: parsePositiveInt(process.env.MOONMIND_RRF_K, 60),
  // Minimum raw Atlas cosine vectorSearchScore ((1+cos)/2, in [0,1]) a document
  // must reach to survive ranking. 0 disables the gate (default, no behaviour
  // change) so it can be calibrated against the eval harness before enabling.
  MIN_SEMANTIC_SCORE: parseUnitFloat(process.env.MOONMIND_MIN_SEMANTIC_SCORE, 0),
  // Feature flags for the heavier read-path stages. Default off so latency/cost
  // stay unchanged until deliberately enabled.
  RERANK_ENABLED: parseBooleanFlag(process.env.MOONMIND_RERANK_ENABLED, false),
  RERANK_CANDIDATES: parsePositiveInt(
    process.env.MOONMIND_RERANK_CANDIDATES,
    20,
  ),
  DECOMPOSE_ENABLED: parseBooleanFlag(
    process.env.MOONMIND_DECOMPOSE_ENABLED,
    false,
  ),
  DECOMPOSE_MAX_SUBQUERIES: parsePositiveInt(
    process.env.MOONMIND_DECOMPOSE_MAX_SUBQUERIES,
    3,
  ),
  ALLOWED_CATEGORIES: [
    "skill",
    "certification",
    "credential" /*  */,
    "education",
    "experience",
    "profile",
    "project",
    "hobby",
    "topic",
  ],
  ALLOWED_DOMAINS: [
    "skills",
    "projects",
    "experience",
    "profile",
    "certifications",
    "education",
    "achievements",
    "research",
    "hobbies",
  ],
  ALLOWED_SUBCATEGORIES: [
    "programming-language",
    "backend",
    "frontend",
    "fullstack",
    "database",
    "devops",
    "cloud",
    "architecture",
    "api-design",
    "system-design",
    "distributed-systems",
    "security",
    "testing",
    "performance-optimization",
    "data-engineering",
    "machine-learning",
    "generative-ai",
    "rag",
    "vector-databases",
    "problem-solving",
    "communication",
    "teamwork",
    "leadership",
    "adaptability",
    "creativity",
    "critical-thinking",
    "decision-making",
    "time-management",
    "ownership",
    "ai",
    "automation",
    "api",
    "search",
    "chatbot",
    "analytics",
    "open-source",
    "experimental",
    "production-grade",
    "scalable",
    "high-performance",
    "integration",
    "enterprise-systems",
    "microservices",
    "computer-science",
    "software-engineering",
    "data-science",
    "artificial-intelligence",
    "mathematics",
    "hackathon",
    "competition",
    "ranking",
    "award",
    "recognition",
    "community",
    "nlp",
    "algorithms",
    "experimentation",
    "technical",
    "non-technical",
    "competitive-programming",
    "writing",
    "gaming",
    "learning",
  ],
  ALLOWED_PROFICIENCY_LEVELS: [
    "beginner",
    "intermediate",
    "advanced",
    "expert",
  ],
  CATEGORY_DOMAIN_MAP: Object.freeze({
    skill: "skills",
    certification: "certifications",
    credential: "certifications",
    education: "education",
    experience: "experience",
    profile: "profile",
    project: "projects",
    hobby: "hobbies",
    topic: "research",
  }),
});

module.exports = VECTOR_CONFIG;
