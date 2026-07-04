"use strict";

// Reciprocal Rank Fusion (RRF).
//
// Replaces the previous position-based score fabrication (keyword/metadata
// "scores" derived from list index and blended with fixed weights). RRF fuses
// several ordered result lists using only each document's *rank within its own
// arm*, which is a legitimate signal, and is robust when the arms produce
// scores on incomparable scales (Atlas cosine score vs. a Mongo filter match).
//
//   rrf_score(doc) = Σ_arm  weight_arm * 1 / (k + rank_arm(doc))
//
// The raw semantic score (Atlas vectorSearchScore) is carried through untouched
// so a downstream threshold gate can still reason about absolute similarity.

const DEFAULT_RRF_K = 60;

function fuseByRRF(resultSets = [], options = {}) {
  const { k = DEFAULT_RRF_K, weights = {} } = options;
  const fused = new Map();

  resultSets.forEach((resultSet) => {
    if (!resultSet || !Array.isArray(resultSet.documents)) {
      return;
    }

    const { source, documents } = resultSet;
    const weight =
      typeof weights[source] === "number" ? weights[source] : 1;

    documents.forEach((document, index) => {
      if (document == null || document.id == null) {
        return;
      }

      const id = String(document.id);
      const rank = index + 1;
      const contribution = weight * (1 / (k + rank));

      const existing = fused.get(id) || {
        document,
        rrf_score: 0,
        semantic_score: 0,
        retrieval_sources: {},
      };

      existing.rrf_score += contribution;
      existing.retrieval_sources[source] = rank;

      if (source === "semantic") {
        const rawScore = Number(document.score);
        if (Number.isFinite(rawScore)) {
          existing.semantic_score = Math.max(
            existing.semantic_score,
            rawScore,
          );
        }
      }

      // Prefer whichever representation actually carries the full content, so a
      // metadata-only hit doesn't shadow the richer semantic-arm document.
      if (!existing.document.content_full && document.content_full) {
        existing.document = document;
      }

      fused.set(id, existing);
    });
  });

  return Array.from(fused.values()).map((entry) => ({
    ...entry.document,
    semantic_score: entry.semantic_score,
    retrieval_sources: entry.retrieval_sources,
    rrf_score: Number(entry.rrf_score.toFixed(8)),
  }));
}

module.exports = {
  DEFAULT_RRF_K,
  fuseByRRF,
};
