"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { fuseByRRF } = require("../src/moonmind/ranking/rrf");

test("a document appearing in multiple arms outranks a single-arm document", () => {
  const resultSets = [
    { source: "semantic", documents: [{ id: "a", score: 0.9 }, { id: "b", score: 0.8 }] },
    { source: "metadata", documents: [{ id: "b" }, { id: "c" }] },
  ];

  const fused = fuseByRRF(resultSets, { k: 60, weights: { semantic: 1, metadata: 1 } });
  const byId = Object.fromEntries(fused.map((d) => [d.id, d]));

  // b is in both arms, a only in semantic -> b should score higher than a.
  assert.ok(byId.b.rrf_score > byId.a.rrf_score);
  assert.equal(fused.length, 3);
});

test("raw semantic score is carried through as semantic_score", () => {
  const fused = fuseByRRF([
    { source: "semantic", documents: [{ id: "a", score: 0.77 }] },
  ]);
  assert.equal(fused[0].semantic_score, 0.77);
});

test("metadata-only docs get zero semantic_score", () => {
  const fused = fuseByRRF([
    { source: "metadata", documents: [{ id: "x" }] },
  ]);
  assert.equal(fused[0].semantic_score, 0);
});

test("per-arm weights scale contribution", () => {
  const high = fuseByRRF([{ source: "semantic", documents: [{ id: "a" }] }], {
    weights: { semantic: 1 },
  });
  const low = fuseByRRF([{ source: "semantic", documents: [{ id: "a" }] }], {
    weights: { semantic: 0.5 },
  });
  assert.ok(high[0].rrf_score > low[0].rrf_score);
});

test("richer content representation wins on dedupe", () => {
  const fused = fuseByRRF([
    { source: "metadata", documents: [{ id: "a", title: "thin" }] },
    { source: "semantic", documents: [{ id: "a", title: "rich", content_full: "details" }] },
  ]);
  assert.equal(fused[0].content_full, "details");
});
