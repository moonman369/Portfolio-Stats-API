const test = require("node:test");
const assert = require("node:assert/strict");

const { validateCreatePayload } = require("../validators/memoryValidator");
const {
  normalizeIntentPayload,
  inferDeterministicIntentTaxonomy,
} = require("../src/moonmind/intentExtractor");
const { buildMetadataQuery } = require("../src/moonmind/retrievalEngine");

function createValidPayload(overrides = {}) {
  return {
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
      subcategory: ["backend", "api-design"],
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
    ...overrides,
  };
}

test("validateCreatePayload rejects invalid metadata.domain", () => {
  assert.throws(
    () =>
      validateCreatePayload(
        createValidPayload({
          metadata: {
            ...createValidPayload().metadata,
            domain: "resume",
          },
        }),
      ),
    /Invalid enum value/i,
  );
});

test("validateCreatePayload rejects invalid metadata.subcategory value", () => {
  assert.throws(
    () =>
      validateCreatePayload(
        createValidPayload({
          metadata: {
            ...createValidPayload().metadata,
            subcategory: ["backend", "invalid-subcategory"],
          },
        }),
      ),
    /subcategory/i,
  );
});

test("validateCreatePayload defaults missing subcategory to []", () => {
  const validated = validateCreatePayload(
    createValidPayload({
      metadata: {
        ...createValidPayload().metadata,
        subcategory: undefined,
      },
    }),
  );

  assert.deepEqual(validated.metadata.subcategory, []);
});

test("normalizeIntentPayload preserves extended taxonomy fields", () => {
  const normalized = normalizeIntentPayload({
    intent: "question",
    retrieval_plan: { semantic: true, keyword: false, metadata: true },
    entities: {},
    filters: {},
    domain: "projects",
    subcategories: ["ai", "rag", "backend", "invalid"],
    requires_retrieval: true,
  });

  assert.equal(normalized.domain, "projects");
  assert.deepEqual(normalized.subcategories, ["ai", "rag", "backend"]);
  assert.equal(normalized.requires_retrieval, true);
});

test("inferDeterministicIntentTaxonomy disables retrieval for greetings", () => {
  const taxonomy = inferDeterministicIntentTaxonomy("hello there");
  assert.equal(taxonomy.requires_retrieval, false);
  assert.equal(taxonomy.domain, null);
  assert.deepEqual(taxonomy.subcategories, []);
});

test("inferDeterministicIntentTaxonomy keeps retrieval for greeting-prefixed certification query", () => {
  const taxonomy = inferDeterministicIntentTaxonomy(
    "Hey! Does Ayan have an oracle certification?",
  );
  assert.equal(taxonomy.requires_retrieval, true);
  assert.equal(taxonomy.domain, "certifications");
});

test("normalizeIntentPayload forces semantic retrieval when required and strategy is empty", () => {
  const normalized = normalizeIntentPayload({
    intent: "greeting",
    retrieval_plan: { semantic: false, keyword: false, metadata: false },
    entities: {},
    filters: {},
    requires_retrieval: true,
  });

  assert.equal(normalized.requires_retrieval, true);
  assert.equal(normalized.retrieval_plan.semantic, true);
});

test("buildMetadataQuery injects strict domain and subcategory filters", () => {
  const query = buildMetadataQuery({
    domain: "projects",
    subcategories: ["rag", "ai"],
    entities: { dates: {} },
    filters: { domain: [] },
  });

  assert.ok(Array.isArray(query.$and));
  assert.deepEqual(query.$and[0], { "metadata.domain": "projects" });
  assert.deepEqual(query.$and[1], {
    "metadata.subcategory": { $in: ["rag", "ai"] },
  });
});
