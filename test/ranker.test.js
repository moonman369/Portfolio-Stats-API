"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { rankDocuments } = require("../src/moonmind/ranker");

test("orders by rrf_score descending and respects limit", () => {
  const docs = [
    { id: "a", rrf_score: 0.01, semantic_score: 0.7 },
    { id: "b", rrf_score: 0.03, semantic_score: 0.7 },
    { id: "c", rrf_score: 0.02, semantic_score: 0.7 },
  ];
  const ranked = rankDocuments(docs, 2);
  assert.deepEqual(ranked.map((d) => d.id), ["b", "c"]);
  assert.equal(ranked[0].score, 0.03);
});

test("semantic threshold gate drops weak matches", () => {
  const docs = [
    { id: "a", rrf_score: 0.05, semantic_score: 0.4 },
    { id: "b", rrf_score: 0.02, semantic_score: 0.75 },
  ];
  const ranked = rankDocuments(docs, 5, { minSemanticScore: 0.6 });
  assert.deepEqual(ranked.map((d) => d.id), ["b"]);
});

test("gate of 0 keeps everything", () => {
  const docs = [
    { id: "a", rrf_score: 0.05, semantic_score: 0 },
    { id: "b", rrf_score: 0.02, semantic_score: 0 },
  ];
  const ranked = rankDocuments(docs, 5, { minSemanticScore: 0 });
  assert.equal(ranked.length, 2);
});

test("deterministic id tie-break on equal scores", () => {
  const docs = [
    { id: "z", rrf_score: 0.02, semantic_score: 0.7 },
    { id: "a", rrf_score: 0.02, semantic_score: 0.7 },
  ];
  const ranked = rankDocuments(docs, 5);
  assert.deepEqual(ranked.map((d) => d.id), ["a", "z"]);
});
