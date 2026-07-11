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

// Mongo and Gemini settings come from the MONGO_* / GEMINI_* contract.
//
// These deliberately do NOT fall back to the older MOONMIND_* names. A stale
// `.env` still carries MOONMIND_VECTOR_COLLECTION=moonmindVectorMemory, a
// collection that no longer exists, so honouring it as a fallback would silently
// point the app at a dead collection and return zero results with no error.
const VECTOR_CONFIG = Object.freeze({
  DB_NAME: process.env.MONGO_DB_NAME || "portfolio-stats-api",
  DOCUMENT_COLLECTION:
    process.env.MONGO_VECTOR_COLLECTION || "moonmind_documents_v3",
  METADATA_INDEX_COLLECTION:
    process.env.MONGO_METADATA_COLLECTION || "moonmindMetadataIndex",
  VECTOR_INDEX_NAME: process.env.MONGO_VECTOR_INDEX || "vector_index",
  VECTOR_FIELD: process.env.MONGO_VECTOR_FIELD || "embedding",

  // --- Gemini embeddings ---------------------------------------------------
  // gemini-embedding-2 auto-normalizes truncated Matryoshka dimensions, so no
  // client-side L2 normalization is needed. Task intent is carried by the
  // prompt templates in utils/embeddingGenerator.js, not a taskType parameter.
  GEMINI_BASE_URL:
    process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2",
  // Must match `numDimensions` on the Atlas vector index (currently 768).
  EMBEDDING_DIMENSIONS: parsePositiveInt(
    process.env.GEMINI_EMBEDDING_DIMENSIONS,
    768,
  ),
  GEMINI_TIMEOUT_MS: parsePositiveInt(process.env.GEMINI_TIMEOUT_MS, 30000),
  GEMINI_MAX_RETRIES: parsePositiveInt(process.env.GEMINI_MAX_RETRIES, 5),
  GEMINI_RETRY_BASE_MS: parsePositiveInt(process.env.GEMINI_RETRY_BASE_MS, 500),
  GEMINI_MAX_BACKOFF_MS: parsePositiveInt(
    process.env.GEMINI_MAX_BACKOFF_MS,
    20000,
  ),
  // gemini-embedding-2 accepts 8192 input tokens. We budget in characters at a
  // deliberately conservative ~3.5 chars/token, because title + summary (4k) +
  // content_full (25k) can otherwise overflow the limit outright.
  MAX_EMBEDDING_INPUT_CHARS: parsePositiveInt(
    process.env.GEMINI_MAX_INPUT_CHARS,
    28000,
  ),

  MAX_SUMMARY_CHARACTERS: 4000,
  SUMMARY_MIN_SENTENCES,
  SUMMARY_MAX_SENTENCES,
  ENFORCE_SUMMARY_SENTENCE_RANGE,
  // --- Retrieval tuning ---------------------------------------------------
  // How many ANN candidates the $vectorSearch stage scans before applying the
  // limit. Higher = better recall, slightly more latency. Only affects recall,
  // never correctness, so it is safe to raise.
  VECTOR_NUM_CANDIDATES: parsePositiveInt(
    process.env.MOONMIND_VECTOR_NUM_CANDIDATES,
    150,
  ),
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
