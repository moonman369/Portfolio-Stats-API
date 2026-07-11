"use strict";

const { embedText } = require("../src/moonmind/adapters/geminiClient");
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

// Truncate on a word boundary when one is reasonably close to the cut, so the
// model is never fed a half-word. Falls back to a hard cut otherwise.
function truncateToChars(text, maxChars) {
  if (maxChars <= 0) {
    return "";
  }
  if (text.length <= maxChars) {
    return text;
  }

  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.8 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd();
}

// gemini-embedding-2 carries task intent in the prompt rather than a taskType
// parameter. Google specifies these literal formats for asymmetric retrieval and
// notes the task string must be used consistently, so the document template here
// and the query template below must not drift apart.
//
// Unlike the previous OpenAI input, `summary_for_embedding` is now always
// included alongside `content_full` rather than used only as a fallback.
function buildEmbeddingText(document = {}) {
  const title =
    typeof document.title === "string" && document.title.trim()
      ? document.title.trim()
      : "none";

  const tags = Array.isArray(document.tags)
    ? document.tags.filter((tag) => typeof tag === "string" && tag.trim())
    : [];

  const summary =
    typeof document.summary_for_embedding === "string"
      ? document.summary_for_embedding.trim()
      : "";

  const content =
    typeof document.content_full === "string" ? document.content_full.trim() : "";

  // Content goes last so overflow truncation trims the long tail of
  // content_full rather than dropping tags or the summary entirely.
  const body = [tags.length ? `Tags: ${tags.join(", ")}` : "", summary, content]
    .filter(Boolean)
    .join("\n");

  const prefix = `title: ${title} | text: `;
  const budget = VECTOR_CONFIG.MAX_EMBEDDING_INPUT_CHARS - prefix.length;

  return `${prefix}${truncateToChars(body, budget)}`;
}

function buildQueryEmbeddingText(query) {
  const trimmed = typeof query === "string" ? query.trim() : "";
  const prefix = "task: search result | query: ";
  const budget = VECTOR_CONFIG.MAX_EMBEDDING_INPUT_CHARS - prefix.length;

  return `${prefix}${truncateToChars(trimmed, budget)}`;
}

async function generateDocumentEmbedding(document) {
  return embedText(buildEmbeddingText(document));
}

async function generateQueryEmbedding(query) {
  return embedText(buildQueryEmbeddingText(query));
}

module.exports = {
  generateDeterministicSummary,
  buildEmbeddingText,
  buildQueryEmbeddingText,
  generateDocumentEmbedding,
  generateQueryEmbedding,
};
