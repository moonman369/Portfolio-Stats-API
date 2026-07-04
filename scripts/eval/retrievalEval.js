"use strict";

/**
 * Retrieval quality harness. Runs a labelled gold set through the real
 * retrieval path (intent -> retrieve -> RRF fuse -> rank) and reports
 * Recall@5, Recall@10, MRR and no-hit precision.
 *
 * Requires live MONGODB + OPENAI credentials in the environment (same as the
 * app). Capture a baseline BEFORE changing config, then re-run after each
 * change / env-flag flip to attribute the delta.
 *
 * Usage:
 *   node scripts/eval/retrievalEval.js
 *   node scripts/eval/retrievalEval.js path/to/custom-goldset.json
 */

const path = require("path");

// Load .env from the project root regardless of the current working directory.
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const { extractIntent } = require("../../src/moonmind/intentExtractor");
const { retrieveDocuments } = require("../../src/moonmind/retrievalEngine");
const { rankDocuments } = require("../../src/moonmind/ranker");

const GOLDSET_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, "goldset.json");

const TOP_K = 10;

async function retrieveTopK(query) {
  const intentPayload = await extractIntent({ query, requestId: "eval" });
  const { documents } = await retrieveDocuments({
    query,
    intentPayload,
    metadata: {},
    limit: 10,
  });
  const ranked = rankDocuments(documents, TOP_K);
  return ranked.map((doc) => String(doc.id));
}

function recallAtK(retrieved, expected, k) {
  if (expected.length === 0) {
    return null;
  }
  const topK = new Set(retrieved.slice(0, k));
  const hits = expected.filter((id) => topK.has(String(id))).length;
  return hits / expected.length;
}

function reciprocalRank(retrieved, expected) {
  const expectedSet = new Set(expected.map(String));
  for (let i = 0; i < retrieved.length; i += 1) {
    if (expectedSet.has(retrieved[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

async function main() {
  const goldset = require(GOLDSET_PATH);
  if (!Array.isArray(goldset) || goldset.length === 0) {
    throw new Error(`Gold set at ${GOLDSET_PATH} is empty or not an array`);
  }

  const rows = [];
  const recall5 = [];
  const recall10 = [];
  const mrr = [];
  let emptyCases = 0;
  let emptyCorrect = 0;

  for (const entry of goldset) {
    const expected = Array.isArray(entry.expected_ids) ? entry.expected_ids : [];
    // eslint-disable-next-line no-await-in-loop
    const retrieved = await retrieveTopK(entry.query);

    if (entry.expect_empty) {
      emptyCases += 1;
      const correct = retrieved.length === 0;
      if (correct) emptyCorrect += 1;
      rows.push({ query: entry.query, expect_empty: true, returned: retrieved.length, ok: correct });
      continue;
    }

    const r5 = recallAtK(retrieved, expected, 5);
    const r10 = recallAtK(retrieved, expected, 10);
    const rr = reciprocalRank(retrieved, expected);
    if (r5 != null) recall5.push(r5);
    if (r10 != null) recall10.push(r10);
    mrr.push(rr);

    rows.push({
      query: entry.query,
      recall5: r5 != null ? r5.toFixed(2) : "-",
      recall10: r10 != null ? r10.toFixed(2) : "-",
      rr: rr.toFixed(2),
    });
  }

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  console.table(rows);
  console.log("\n=== Aggregate ===");
  console.log(`Recall@5:  ${avg(recall5).toFixed(3)}`);
  console.log(`Recall@10: ${avg(recall10).toFixed(3)}`);
  console.log(`MRR:       ${avg(mrr).toFixed(3)}`);
  if (emptyCases > 0) {
    console.log(
      `No-hit precision: ${(emptyCorrect / emptyCases).toFixed(3)} (${emptyCorrect}/${emptyCases})`,
    );
  }
  process.exit(0);
}

main().catch((error) => {
  console.error("retrievalEval.fatal", error);
  process.exit(1);
});
