"use strict";

// Embedding generation moved to Atlas (autoEmbed vector index): the index
// vectorizes the configured text field server-side at insert/update and at
// query time, so this module no longer talks to any embedding provider. Only
// the deterministic summary fallback for documents without an explicit
// `summary_for_embedding` remains.
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

module.exports = {
  generateDeterministicSummary,
};
