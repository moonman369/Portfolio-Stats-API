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
    "experience",
    "project",
    "hobby",
    "topic",
  ],
  ALLOWED_DOMAINS: [
    "skills",
    "experience",
    "certifications",
    "projects",
    "hobbies",
    "topics",
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
    experience: "experience",
    project: "projects",
    hobby: "hobbies",
    topic: "topics",
  }),
});

module.exports = VECTOR_CONFIG;
