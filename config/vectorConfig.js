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

const VECTOR_CONFIG = Object.freeze({
  DB_NAME: process.env.MOONMIND_DB_NAME || "portfolio-stats-api",
  DOCUMENT_COLLECTION:
    process.env.MOONMIND_VECTOR_COLLECTION || "moonmindVectorMemory",
  METADATA_INDEX_COLLECTION:
    process.env.MOONMIND_METADATA_COLLECTION || "moonmindMetadataIndex",
  EMBEDDING_MODEL:
    process.env.MOONMIND_EMBEDDING_MODEL || "text-embedding-3-small",
  VECTOR_INDEX_NAME:
    process.env.MOONMIND_VECTOR_INDEX_NAME || "moonmind_vector_index",
  MAX_SUMMARY_CHARACTERS: 4000,
  SUMMARY_MIN_SENTENCES,
  SUMMARY_MAX_SENTENCES,
  ENFORCE_SUMMARY_SENTENCE_RANGE,
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
