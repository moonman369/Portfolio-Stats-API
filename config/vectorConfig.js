"use strict";

const VECTOR_CONFIG = Object.freeze({
  DB_NAME: process.env.MOONMIND_DB_NAME || "portfolio-stats-api",
  DOCUMENT_COLLECTION: process.env.MOONMIND_VECTOR_COLLECTION || "moonmindVectorMemory",
  METADATA_INDEX_COLLECTION:
    process.env.MOONMIND_METADATA_COLLECTION || "moonmindMetadataIndex",
  EMBEDDING_MODEL: process.env.MOONMIND_EMBEDDING_MODEL || "text-embedding-3-small",
  VECTOR_INDEX_NAME: process.env.MOONMIND_VECTOR_INDEX_NAME || "moonmind_vector_index",
  MAX_SUMMARY_CHARACTERS: 4000,
  SUMMARY_MIN_SENTENCES: 3,
  SUMMARY_MAX_SENTENCES: 6,
  ALLOWED_CATEGORIES: [
    "skill",
    "certification",
    "credential",
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
  ALLOWED_PROFICIENCY_LEVELS: ["beginner", "intermediate", "advanced", "expert"],
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
