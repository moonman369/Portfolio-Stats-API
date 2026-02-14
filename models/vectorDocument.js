"use strict";

const VECTOR_CONFIG = require("../config/vectorConfig");

const vectorDocumentJsonSchema = {
  bsonType: "object",
  additionalProperties: false,
  required: [
    "id",
    "title",
    "category",
    "tags",
    "summary_for_embedding",
    "content_full",
    "metadata",
    "embedding",
    "created_at",
    "updated_at",
  ],
  properties: {
    id: { bsonType: "string" },
    title: { bsonType: "string" },
    category: { enum: VECTOR_CONFIG.ALLOWED_CATEGORIES },
    tags: {
      bsonType: "array",
      items: { bsonType: "string" },
    },
    summary_for_embedding: { bsonType: "string" },
    content_full: { bsonType: ["string", "null"] },
    metadata: {
      bsonType: "object",
      additionalProperties: false,
      required: [
        "domain",
        "subcategory",
        "date_start",
        "date_end",
        "completion_year",
        "verified",
        "proficiency_level",
        "organization",
        "impact_score",
        "is_active",
        "external_link",
      ],
      properties: {
        domain: { enum: VECTOR_CONFIG.ALLOWED_DOMAINS },
        subcategory: { bsonType: ["string", "null"] },
        date_start: { bsonType: ["string", "null"] },
        date_end: { bsonType: ["string", "null"] },
        completion_year: { bsonType: ["int", "long", "double", "null"] },
        verified: { bsonType: "bool" },
        proficiency_level: {
          enum: [...VECTOR_CONFIG.ALLOWED_PROFICIENCY_LEVELS, null],
        },
        organization: { bsonType: ["string", "null"] },
        impact_score: { bsonType: ["int", "long", "double", "null"] },
        is_active: { bsonType: "bool" },
        external_link: { bsonType: ["string", "null"] },
      },
    },
    embedding: {
      bsonType: "array",
      items: { bsonType: "double" },
    },
    created_at: { bsonType: "string" },
    updated_at: { bsonType: "string" },
  },
};

const moonmindPayloadExamples = Object.freeze({
  skill: {
    id: "f95f41ee-2dfb-4ba8-a724-8083c0f06910",
    title: "Node.js API Architecture",
    category: "skill",
    tags: ["nodejs", "express", "mongodb", "api-design"],
    summary_for_embedding:
      "Built backend APIs with Node.js and Express for portfolio analytics workloads. Used MongoDB indexes and aggregation pipelines between 2023 and 2025 to optimize retrieval. Implemented deterministic validation and schema-first request handling. Delivered measurable latency reduction for production chat and analytics endpoints.",
    content_full:
      "Designed and maintained production backend services for portfolio stats retrieval, ingestion, and deterministic search alignment.",
    metadata: {
      domain: "skills",
      subcategory: "backend",
      date_start: "2023-01-01T00:00:00.000Z",
      date_end: null,
      completion_year: null,
      verified: true,
      proficiency_level: "expert",
      organization: "MoonMind",
      impact_score: 91,
      is_active: true,
      external_link: "https://moonman.in",
    },
  },
  certification: {
    id: "4d073dc4-b2df-47e0-8e52-72b4ee95f0a8",
    title: "AWS Certified Developer - Associate",
    category: "certification",
    tags: ["aws", "cloud", "serverless"],
    summary_for_embedding:
      "Earned AWS Certified Developer Associate credential in 2024 focused on secure cloud application delivery. Applied certification topics to API deployment workflows and operations monitoring. Improved deployment consistency and cloud architecture decisions for backend services.",
    content_full: null,
    metadata: {
      domain: "certifications",
      subcategory: "cloud",
      date_start: null,
      date_end: "2024-06-10T00:00:00.000Z",
      completion_year: 2024,
      verified: true,
      proficiency_level: "advanced",
      organization: "Amazon Web Services",
      impact_score: 78,
      is_active: true,
      external_link: "https://aws.amazon.com/certification/",
    },
  },
  experience: {
    id: "6d65363a-3879-4a5d-9967-9f21272f4d6e",
    title: "Backend Engineer",
    category: "experience",
    tags: ["backend", "microservices", "observability"],
    summary_for_embedding:
      "Served as backend engineer from 2022 to 2025 designing scalable API systems. Built deterministic validation and retrieval components in Node.js and MongoDB. Improved production reliability through structured observability and incident reduction workflows. Increased response accuracy by enforcing schema-driven memory and search pipelines.",
    content_full:
      "Owned core backend systems for intent routing, retrieval, and portfolio response assembly.",
    metadata: {
      domain: "experience",
      subcategory: "engineering",
      date_start: "2022-02-01T00:00:00.000Z",
      date_end: null,
      completion_year: null,
      verified: true,
      proficiency_level: "expert",
      organization: "MoonMind",
      impact_score: 94,
      is_active: true,
      external_link: null,
    },
  },
  project: {
    id: "5eb65384-9895-4493-9c07-f566d683f5f1",
    title: "MoonMind Full Search Engine",
    category: "project",
    tags: ["semantic-search", "reranking", "vector-search"],
    summary_for_embedding:
      "Built MoonMind full search pipeline integrating metadata, keyword, boolean, semantic, and reranking stages during 2025. Implemented deterministic intent alignment with strict schema filters. Added verified and impact-based reranking boosts to improve relevance. Enabled top-N retrieval for portfolio-grounded responses.",
    content_full:
      "Implemented full retrieval flow with strict rule enforcement and no inference drift.",
    metadata: {
      domain: "projects",
      subcategory: "search",
      date_start: "2025-01-10T00:00:00.000Z",
      date_end: null,
      completion_year: null,
      verified: true,
      proficiency_level: "expert",
      organization: "MoonMind",
      impact_score: 96,
      is_active: true,
      external_link: "https://moonman.in",
    },
  },
  hobby: {
    id: "f64f42df-b653-4dbd-b8de-a34f53f2cb22",
    title: "Competitive Programming",
    category: "hobby",
    tags: ["leetcode", "algorithms", "data-structures"],
    summary_for_embedding:
      "Practiced competitive programming from 2021 through 2025 using algorithmic problem solving platforms. Focused on data structures, graph algorithms, and performance-focused coding in JavaScript. Improved coding speed and debugging precision for production backend development work.",
    content_full: null,
    metadata: {
      domain: "hobbies",
      subcategory: "technical",
      date_start: "2021-01-01T00:00:00.000Z",
      date_end: null,
      completion_year: null,
      verified: false,
      proficiency_level: "advanced",
      organization: null,
      impact_score: 67,
      is_active: true,
      external_link: null,
    },
  },
});

module.exports = {
  vectorDocumentJsonSchema,
  moonmindPayloadExamples,
};
