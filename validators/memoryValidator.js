"use strict";

const { z } = require("zod");
const { validate: validateUuid } = require("uuid");
const VECTOR_CONFIG = require("../config/vectorConfig");

const PROHIBITED_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,
  /api[_-]?key\s*[:=]/i,
  /authorization\s*[:=]/i,
  /bearer\s+[a-z0-9\-_\.]+/i,
  /system\s*prompt/i,
  /ignore\s+previous\s+instructions/i,
  /chain[-\s]?of[-\s]?thought/i,
  /social\s+security/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /-----begin\s+private\s+key-----/i,
];

const metadataSchema = z
  .object({
    domain: z.enum(VECTOR_CONFIG.ALLOWED_DOMAINS),
    subcategory: z.string().trim().min(1).max(120).nullable(),
    date_start: z.string().datetime({ offset: true }).nullable(),
    date_end: z.string().datetime({ offset: true }).nullable(),
    completion_year: z.number().int().min(1900).max(3000).nullable(),
    verified: z.boolean(),
    proficiency_level: z
      .enum(VECTOR_CONFIG.ALLOWED_PROFICIENCY_LEVELS)
      .nullable(),
    organization: z.string().trim().min(1).max(160).nullable(),
    impact_score: z.number().min(0).max(100).nullable(),
    is_active: z.boolean(),
    external_link: z.string().url().max(512).nullable(),
  })
  .strict();

const baseDocumentSchema = z
  .object({
    id: z
      .string()
      .refine((value) => validateUuid(value), "id must be a valid UUID"),
    title: z.string().trim().min(2).max(180),
    category: z.enum(VECTOR_CONFIG.ALLOWED_CATEGORIES),
    tags: z.array(z.string().trim().min(1).max(64)).max(50),
    summary_for_embedding: z.string().trim().min(20).max(VECTOR_CONFIG.MAX_SUMMARY_CHARACTERS).optional(),
    content_full: z.string().trim().max(25000).nullable(),
    metadata: metadataSchema,
  })
  .strict();

const updateDocumentSchema = baseDocumentSchema;
const createDocumentSchema = baseDocumentSchema;

function assertNoProhibitedContent(document) {
  const fieldsToInspect = [
    document.title,
    ...(document.tags || []),
    document.summary_for_embedding || "",
    document.content_full || "",
    document.metadata?.subcategory || "",
    document.metadata?.organization || "",
  ];

  const combined = fieldsToInspect.join("\n");
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(combined)) {
      throw createValidationError("Document contains prohibited sensitive or system-level content");
    }
  }
}

function countSentences(text) {
  const matches = text.match(/[^.!?]+[.!?]+/g);
  return matches ? matches.length : 0;
}

function assertSummaryConstraints(document) {
  if (!document.summary_for_embedding) {
    return;
  }
  const sentenceCount = countSentences(document.summary_for_embedding);
  if (
    sentenceCount < VECTOR_CONFIG.SUMMARY_MIN_SENTENCES ||
    sentenceCount > VECTOR_CONFIG.SUMMARY_MAX_SENTENCES
  ) {
    throw createValidationError(
      `summary_for_embedding must contain ${VECTOR_CONFIG.SUMMARY_MIN_SENTENCES}-${VECTOR_CONFIG.SUMMARY_MAX_SENTENCES} sentences`,
    );
  }
}

function assertDomainCategoryAlignment(document) {
  const expectedDomain = VECTOR_CONFIG.CATEGORY_DOMAIN_MAP[document.category];
  if (document.metadata.domain !== expectedDomain) {
    throw createValidationError(
      `metadata.domain must be '${expectedDomain}' when category is '${document.category}'`,
    );
  }
}

function assertDateConsistency(document) {
  const { date_start: dateStart, date_end: dateEnd, completion_year: completionYear } = document.metadata;

  if (dateStart && dateEnd && new Date(dateStart).getTime() > new Date(dateEnd).getTime()) {
    throw createValidationError("metadata.date_start cannot be after metadata.date_end");
  }

  if (dateEnd && completionYear && new Date(dateEnd).getUTCFullYear() !== completionYear) {
    throw createValidationError("metadata.completion_year must match metadata.date_end year");
  }
}

function normalizeMetadata(metadata) {
  return {
    domain: metadata.domain,
    subcategory: metadata.subcategory,
    date_start: metadata.date_start,
    date_end: metadata.date_end,
    completion_year: metadata.completion_year,
    verified: metadata.verified,
    proficiency_level: metadata.proficiency_level,
    organization: metadata.organization,
    impact_score: metadata.impact_score,
    is_active: metadata.is_active,
    external_link: metadata.external_link,
  };
}

function normalizeDocument(document) {
  return {
    ...document,
    title: document.title.trim(),
    tags: document.tags.map((tag) => tag.trim().toLowerCase()),
    summary_for_embedding: document.summary_for_embedding?.trim(),
    content_full: document.content_full,
    metadata: normalizeMetadata(document.metadata),
  };
}

function validateCreatePayload(payload) {
  const parsed = createDocumentSchema.safeParse(payload);
  if (!parsed.success) {
    throw createValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const normalized = normalizeDocument(parsed.data);
  assertDomainCategoryAlignment(normalized);
  assertDateConsistency(normalized);
  assertNoProhibitedContent(normalized);
  assertSummaryConstraints(normalized);
  return normalized;
}

function validateUpdatePayload(payload) {
  const parsed = updateDocumentSchema.safeParse(payload);
  if (!parsed.success) {
    throw createValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  const normalized = normalizeDocument(parsed.data);
  assertDomainCategoryAlignment(normalized);
  assertDateConsistency(normalized);
  assertNoProhibitedContent(normalized);
  assertSummaryConstraints(normalized);
  return normalized;
}

function validateDeletePayload(payload) {
  const schema = z
    .object({
      id: z
        .string()
        .refine((value) => validateUuid(value), "id must be a valid UUID"),
    })
    .strict();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw createValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}

function createValidationError(message) {
  const error = new Error(message);
  error.name = "ValidationError";
  return error;
}

module.exports = {
  validateCreatePayload,
  validateUpdatePayload,
  validateDeletePayload,
};
