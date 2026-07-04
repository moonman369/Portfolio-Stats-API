"use strict";

/**
 * One-time backfill: recompute the `embedding` of every document in the vector
 * collection using the improved embedding input (title + tags + content_full,
 * falling back to the summary). Run this AFTER deploying the embeddingGenerator
 * change so stored vectors match the new query-side representation.
 *
 * Usage:
 *   node scripts/reembed.js --dry-run     # report only, no writes
 *   node scripts/reembed.js               # re-embed and update in place
 *
 * Safe to re-run (idempotent-ish): it only rewrites `embedding` + `updated_at`.
 * Recommended: run against a staging copy first and compare eval metrics
 * (scripts/eval/retrievalEval.js) before promoting to production.
 */

// Load .env from the project root regardless of the current working directory,
// so the script works when invoked as `node scripts/reembed.js` from anywhere.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { connectToDatabase } = require("../mongo");
const VECTOR_CONFIG = require("../config/vectorConfig");
const {
  buildEmbeddingInput,
  generateEmbeddingVector,
} = require("../utils/embeddingGenerator");

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const { db } = await connectToDatabase({ apiStrict: false });
  const collection = db.collection(VECTOR_CONFIG.DOCUMENT_COLLECTION);

  const cursor = collection.find(
    {},
    {
      projection: {
        _id: 0,
        id: 1,
        title: 1,
        tags: 1,
        content_full: 1,
        summary_for_embedding: 1,
      },
    },
  );

  let processed = 0;
  let updated = 0;
  let failed = 0;

  // eslint-disable-next-line no-await-in-loop
  for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
    processed += 1;
    const input = buildEmbeddingInput(doc);

    if (DRY_RUN) {
      console.log(`[dry-run] ${doc.id} :: ${input.slice(0, 120).replace(/\n/g, " ")}`);
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      const embedding = await generateEmbeddingVector(input);
      // eslint-disable-next-line no-await-in-loop
      await collection.updateOne(
        { id: doc.id },
        { $set: { embedding, updated_at: new Date().toISOString() } },
      );
      updated += 1;
      console.log(`[ok] ${doc.id} (${embedding.length} dims)`);
    } catch (error) {
      failed += 1;
      console.error(`[fail] ${doc.id}: ${error?.message}`);
    }
  }

  console.log(
    `\nDone. processed=${processed} updated=${updated} failed=${failed} dryRun=${DRY_RUN}`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("reembed.fatal", error);
  process.exit(1);
});
