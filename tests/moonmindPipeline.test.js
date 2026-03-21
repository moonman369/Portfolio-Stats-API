const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeIntentPayload } = require("../src/moonmind/intentExtractor");
const { rankDocuments } = require("../src/moonmind/ranker");
const {
  buildKeywordQuery,
  buildMetadataQuery,
} = require("../src/moonmind/retrievalEngine");

test("normalizeIntentPayload defaults semantic retrieval when plan is missing", () => {
  const payload = normalizeIntentPayload({
    intent: "question",
    retrieval_plan: {},
    entities: {},
    filters: {},
  });

  assert.equal(payload.intent, "question");
  assert.equal(payload.retrieval_plan.semantic, true);
  assert.equal(payload.retrieval_plan.keyword, false);
  assert.equal(payload.retrieval_plan.metadata, false);
});

test("rankDocuments uses MVP weighted scoring", () => {
  const ranked = rankDocuments(
    [
      { id: "b", semantic_score: 0.5, keyword_match: 1, metadata_match: 1 },
      { id: "a", semantic_score: 1, keyword_match: 0, metadata_match: 0 },
    ],
    5,
  );

  assert.deepEqual(
    ranked.map((document) => document.id),
    ["b", "a"],
  );
  assert.equal(ranked[0].score, 0.75);
  assert.equal(ranked[1].score, 0.5);
});

test("buildKeywordQuery includes query and entity terms", () => {
  const query = buildKeywordQuery("Tell me about Node APIs", {
    entities: {
      skills: ["Node.js"],
      projects: [],
      certifications: [],
      organizations: [],
    },
    filters: { domain: ["projects"] },
  });

  assert.ok(Array.isArray(query.$or));
  assert.ok(query.$or.length > 0);
});

test("buildMetadataQuery applies domain, date, and runtime metadata filters", () => {
  const query = buildMetadataQuery(
    {
      entities: {
        skills: ["Node.js"],
        projects: [],
        certifications: [],
        organizations: [],
        dates: { from: "2022-01-01", to: "2024-12-31" },
      },
      filters: { domain: ["projects"], time_range: null },
    },
    { source: "resume" },
  );

  assert.ok(Array.isArray(query.$and));
  assert.equal(query.$and.length >= 3, true);
});
