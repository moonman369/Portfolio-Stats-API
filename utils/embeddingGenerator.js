"use strict";

const { createEmbedding } = require("../src/moonmind/adapters/openaiClient");
const VECTOR_CONFIG = require("../config/vectorConfig");

function generateDeterministicSummary(document) {
  const technologies = document.tags.length ? document.tags.join(", ") : "portfolio technologies";
  const timeContext = [document.metadata.date_start, document.metadata.date_end]
    .filter(Boolean)
    .join(" to ") ||
    (document.metadata.completion_year ? `completed in ${document.metadata.completion_year}` : "ongoing timeframe");
  const impact =
    document.metadata.impact_score !== null
      ? `impact score ${document.metadata.impact_score}`
      : "impact score not specified";
  const organization = document.metadata.organization || "independent portfolio context";

  return [
    `${document.title} is categorized as ${document.category} in the ${document.metadata.domain} domain.`,
    `Core technologies and keywords include ${technologies}.`,
    `The documented time context is ${timeContext}.`,
    `The work is associated with ${organization} and has ${impact}.`,
    `Verification status is ${document.metadata.verified ? "verified" : "unverified"} with activity state ${document.metadata.is_active ? "active" : "inactive"}.`,
  ].join(" ");
}

// Build the text that is actually embedded. Previously only
// `summary_for_embedding` was vectorized — and when auto-generated that is
// metadata boilerplate, so vectors encoded structure rather than substance.
// We now embed title + tags + the real `content_full` when it exists, falling
// back to the summary. The human-facing `summary_for_embedding` field is left
// untouched for display.
function buildEmbeddingInput(document = {}) {
  const title = typeof document.title === "string" ? document.title.trim() : "";
  const tags = Array.isArray(document.tags)
    ? document.tags.filter((tag) => typeof tag === "string" && tag.trim())
    : [];
  const content =
    typeof document.content_full === "string" && document.content_full.trim()
      ? document.content_full.trim()
      : document.summary_for_embedding || "";

  return [title, tags.length ? `Tags: ${tags.join(", ")}` : "", content]
    .filter(Boolean)
    .join("\n");
}

async function generateEmbeddingVector(summaryText) {
  const response = await createEmbedding({
    model: VECTOR_CONFIG.EMBEDDING_MODEL,
    input: summaryText,
  });

  const embedding = response?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    const error = new Error("Embedding generation failed: empty vector response");
    error.name = "EmbeddingError";
    throw error;
  }

  return embedding;
}

module.exports = {
  generateDeterministicSummary,
  buildEmbeddingInput,
  generateEmbeddingVector,
};
