"use strict";

const { createChatCompletion } = require("../adapters/openaiClient");
const { debugLog, serializeError } = require("../utils/debug");
const VECTOR_CONFIG = require("../../../config/vectorConfig");

const RERANK_MODEL =
  process.env.MOONMIND_RERANK_MODEL ||
  process.env.MOONMIND_RESPONSE_MODEL ||
  "gpt-4o-mini";

const MAX_CONTENT_CHARS = 900;

function truncate(value, max = MAX_CONTENT_CHARS) {
  if (typeof value !== "string") {
    return "";
  }
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function buildCandidateView(documents) {
  return documents.map((document, index) => ({
    index,
    title: document.title || "Untitled",
    content: truncate(document.content_full || document.summary_for_embedding),
    tags: Array.isArray(document.tags) ? document.tags.slice(0, 12) : [],
  }));
}

function buildMessages(query, candidates) {
  const systemPrompt = [
    "You are a precise relevance ranker for a retrieval system.",
    "Given a user query and a numbered list of candidate documents, order the",
    "candidates from most to least relevant to answering the query.",
    "Only use the provided content. Do not invent documents.",
    'Return STRICT JSON: {"order": [<candidate index>, ...]} listing every',
    "candidate index exactly once, best first. No prose, no extra keys.",
  ].join(" ");

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: JSON.stringify({ query, candidates }, null, 2),
    },
  ];
}

function parseOrder(content, count) {
  const parsed = JSON.parse(content);
  const order = Array.isArray(parsed?.order) ? parsed.order : null;
  if (!order) {
    return null;
  }

  const seen = new Set();
  const cleaned = [];
  order.forEach((value) => {
    const index = Number(value);
    if (Number.isInteger(index) && index >= 0 && index < count && !seen.has(index)) {
      seen.add(index);
      cleaned.push(index);
    }
  });

  // Append any candidates the model dropped so nothing is silently lost.
  for (let index = 0; index < count; index += 1) {
    if (!seen.has(index)) {
      cleaned.push(index);
    }
  }

  return cleaned;
}

// Second-stage LLM rerank over the top fused candidates. Best-effort: on any
// failure it returns the input order (sliced), so retrieval never breaks.
async function rerankDocuments({ query, documents, limit = 5 }) {
  if (!Array.isArray(documents) || documents.length <= 1) {
    return Array.isArray(documents) ? documents.slice(0, limit) : [];
  }

  const candidatePool = documents.slice(0, VECTOR_CONFIG.RERANK_CANDIDATES);

  try {
    const completion = await createChatCompletion({
      model: RERANK_MODEL,
      messages: buildMessages(query, buildCandidateView(candidatePool)),
      responseFormat: { type: "json_object" },
      temperature: 0,
    });

    const content = completion?.choices?.[0]?.message?.content;
    const order = content ? parseOrder(content, candidatePool.length) : null;

    if (!order) {
      debugLog("moonmind.rerank.fallback", { reason: "unparseable_order" });
      return candidatePool.slice(0, limit);
    }

    const reordered = order.map((index) => candidatePool[index]);
    debugLog("moonmind.rerank.success", {
      candidateCount: candidatePool.length,
      returnedCount: Math.min(limit, reordered.length),
    });
    return reordered.slice(0, limit);
  } catch (error) {
    debugLog("moonmind.rerank.error", { error: serializeError(error) });
    return candidatePool.slice(0, limit);
  }
}

module.exports = {
  rerankDocuments,
};
