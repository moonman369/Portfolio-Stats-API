const test = require("node:test");
const assert = require("node:assert/strict");

const { vectorDocumentJsonSchema } = require("../models/vectorDocument");
const { validateCreatePayload } = require("../validators/memoryValidator");
const {
  sanitizeDocumentsForLLM,
} = require("../src/moonmind/documentSanitizer");

function createValidPayload(overrides = {}) {
  const payload = {
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
  };

  return {
    ...payload,
    ...overrides,
    metadata: {
      ...payload.metadata,
      ...(overrides.metadata || {}),
    },
  };
}

test("vectorDocumentJsonSchema metadata no longer requires date_end or external_link", () => {
  const metadataSchema = vectorDocumentJsonSchema.properties.metadata;
  assert.equal(metadataSchema.required.includes("date_start"), false);
  assert.equal(metadataSchema.required.includes("date_end"), false);
  assert.equal(metadataSchema.required.includes("completion_year"), false);
  assert.equal(metadataSchema.required.includes("external_link"), false);
  assert.deepEqual(metadataSchema.properties.date_end, {
    bsonType: ["string", "null"],
  });
  assert.deepEqual(metadataSchema.properties.external_links, {
    bsonType: ["object", "null"],
    additionalProperties: {
      bsonType: "string",
    },
  });
});

test("validateCreatePayload accepts date_end when present", () => {
  const validated = validateCreatePayload(
    createValidPayload({
      metadata: {
        date_end: "2025-12-31T00:00:00.000Z",
        completion_year: 2025,
      },
    }),
  );

  assert.equal(validated.metadata.date_end, "2025-12-31T00:00:00.000Z");
});

test("validateCreatePayload accepts date_end as null", () => {
  const validated = validateCreatePayload(
    createValidPayload({
      metadata: {
        date_end: null,
        completion_year: null,
      },
    }),
  );

  assert.equal(validated.metadata.date_end, null);
});

test("validateCreatePayload accepts missing date_end", () => {
  const payload = createValidPayload();
  delete payload.metadata.date_end;

  const validated = validateCreatePayload(payload);

  assert.equal(
    Object.prototype.hasOwnProperty.call(validated.metadata, "date_end"),
    false,
  );
});

test("validateCreatePayload accepts missing date_start", () => {
  const payload = createValidPayload();
  delete payload.metadata.date_start;

  const validated = validateCreatePayload(payload);

  assert.equal(
    Object.prototype.hasOwnProperty.call(validated.metadata, "date_start"),
    false,
  );
});

test("validateCreatePayload accepts missing completion_year", () => {
  const payload = createValidPayload();
  delete payload.metadata.completion_year;

  const validated = validateCreatePayload(payload);

  assert.equal(
    Object.prototype.hasOwnProperty.call(validated.metadata, "completion_year"),
    false,
  );
});

test("validateCreatePayload allows completion_year to differ from date_end year", () => {
  const validated = validateCreatePayload(
    createValidPayload({
      metadata: {
        date_end: "2025-12-31T00:00:00.000Z",
        completion_year: 2024,
      },
    }),
  );

  assert.equal(validated.metadata.date_end, "2025-12-31T00:00:00.000Z");
  assert.equal(validated.metadata.completion_year, 2024);
});

test("validateCreatePayload accepts dynamic external_links object values", () => {
  const validated = validateCreatePayload(
    createValidPayload({
      metadata: {
        external_link: undefined,
        external_links: {
          portfolio: "https://moonman.in",
          github: "https://github.com/moonman",
          custom_id: "moonmind-profile-01",
        },
      },
    }),
  );

  assert.deepEqual(validated.metadata.external_links, {
    portfolio: "https://moonman.in",
    github: "https://github.com/moonman",
    custom_id: "moonmind-profile-01",
  });
});

test("validateCreatePayload rejects external_links with non-string values", () => {
  assert.throws(
    () =>
      validateCreatePayload(
        createValidPayload({
          metadata: {
            external_link: undefined,
            external_links: {
              portfolio: 42,
            },
          },
        }),
      ),
    /Expected string|Invalid input/i,
  );

  assert.throws(
    () =>
      validateCreatePayload(
        createValidPayload({
          metadata: {
            external_link: undefined,
            external_links: {
              portfolio: { nested: "value" },
            },
          },
        }),
      ),
    /Expected string|Invalid input/i,
  );
});

test("validateCreatePayload keeps legacy external_link documents valid", () => {
  const validated = validateCreatePayload(createValidPayload());
  assert.equal(validated.metadata.external_link, "https://moonman.in");
});

test("validateCreatePayload prioritizes external_links when both fields are present", () => {
  const validated = validateCreatePayload(
    createValidPayload({
      metadata: {
        external_link: "https://legacy.example.com",
        external_links: {
          portfolio: "https://moonman.in",
        },
      },
    }),
  );

  assert.deepEqual(validated.metadata.external_links, {
    portfolio: "https://moonman.in",
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(validated.metadata, "external_link"),
    false,
  );
});

test("sanitizeDocumentsForLLM supports legacy and mixed external link schemas", () => {
  const [legacy, mixed] = sanitizeDocumentsForLLM([
    {
      title: "Legacy",
      summary_for_embedding: "summary",
      tags: [],
      metadata: {
        domain: "skills",
        external_link: "https://legacy.example.com",
      },
    },
    {
      title: "Mixed",
      summary_for_embedding: "summary",
      tags: [],
      metadata: {
        domain: "skills",
        external_link: "https://legacy.example.com",
        external_links: {
          portfolio: "https://moonman.in",
          resume: "resume-identifier",
        },
      },
    },
  ]);

  assert.equal(legacy.metadata.external_link, "https://legacy.example.com");
  assert.deepEqual(mixed.metadata.external_links, {
    portfolio: "https://moonman.in",
    resume: "resume-identifier",
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(mixed.metadata, "external_link"),
    false,
  );
});
