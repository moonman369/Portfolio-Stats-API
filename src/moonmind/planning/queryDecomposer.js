"use strict";

const { createChatCompletion } = require("../adapters/openaiClient");
const { debugLog, serializeError } = require("../utils/debug");
const VECTOR_CONFIG = require("../../../config/vectorConfig");

const DECOMPOSE_MODEL =
  process.env.MOONMIND_DECOMPOSE_MODEL ||
  process.env.MOONMIND_INTENT_MODEL ||
  "gpt-4o-mini";

function buildMessages(query, maxSubqueries) {
  const systemPrompt = [
    "You split a user question into independent, self-contained sub-questions",
    "for a retrieval system, so each distinct information need can be searched",
    "separately.",
    "RULES:",
    `- Return at most ${maxSubqueries} sub-questions.`,
    "- If the question asks about only ONE thing, return it unchanged as the",
    "  single sub-question (do NOT invent extra parts).",
    "- Each sub-question must be standalone and keyword-rich (resolve pronouns).",
    '- Return STRICT JSON: {"subqueries": ["...", "..."]}. No prose.',
  ].join(" ");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: query },
  ];
}

function normalizeSubqueries(raw, originalQuery, maxSubqueries) {
  if (!Array.isArray(raw)) {
    return [originalQuery];
  }

  const cleaned = [
    ...new Set(
      raw
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  ].slice(0, maxSubqueries);

  return cleaned.length > 0 ? cleaned : [originalQuery];
}

// Returns an array of sub-queries. For single-topic prompts this is just
// [query], letting the caller take the normal single-query path. Best-effort:
// any failure falls back to [query].
async function decomposeQuery({ query, requestId }) {
  const maxSubqueries = VECTOR_CONFIG.DECOMPOSE_MAX_SUBQUERIES;

  try {
    const completion = await createChatCompletion({
      model: DECOMPOSE_MODEL,
      messages: buildMessages(query, maxSubqueries),
      responseFormat: { type: "json_object" },
      temperature: 0,
    });

    const content = completion?.choices?.[0]?.message?.content;
    const parsed = content ? JSON.parse(content) : null;
    const subqueries = normalizeSubqueries(
      parsed?.subqueries,
      query,
      maxSubqueries,
    );

    debugLog("moonmind.decompose.result", {
      requestId,
      subqueryCount: subqueries.length,
      subqueries,
    });

    return subqueries;
  } catch (error) {
    debugLog("moonmind.decompose.error", {
      requestId,
      error: serializeError(error),
    });
    return [query];
  }
}

module.exports = {
  decomposeQuery,
};
