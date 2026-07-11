"use strict";

const { debugLog, serializeError } = require("../utils/debug");
const VECTOR_CONFIG = require("../../../config/vectorConfig");

const EMBED_PATH = `/v1beta/models/${VECTOR_CONFIG.EMBEDDING_MODEL}:embedContent`;

// 429 is the rate limit; the 5xx family and 408 are transient. Everything else
// (401, 400, ...) is a caller error and retrying only burns quota.
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function createEmbeddingError(message, status = null) {
  const error = new Error(message);
  // Surfaced as 429 by the route layer so callers can back off themselves.
  error.name = status === 429 ? "RateLimitError" : "EmbeddingError";
  error.status = status;
  return error;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Prefer the server's Retry-After when present, otherwise exponential backoff
// with full jitter to avoid a thundering herd when several docs retry at once.
function computeBackoffMs(attempt, retryAfterHeader) {
  const retryAfterSeconds = Number.parseFloat(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(retryAfterSeconds * 1000, VECTOR_CONFIG.GEMINI_MAX_BACKOFF_MS);
  }

  const exponential = VECTOR_CONFIG.GEMINI_RETRY_BASE_MS * 2 ** attempt;
  const jitter = Math.random() * VECTOR_CONFIG.GEMINI_RETRY_BASE_MS;
  return Math.min(exponential + jitter, VECTOR_CONFIG.GEMINI_MAX_BACKOFF_MS);
}

async function requestEmbedding(text) {
  const response = await fetch(`${VECTOR_CONFIG.GEMINI_BASE_URL}${EMBED_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": VECTOR_CONFIG.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      output_dimensionality: VECTOR_CONFIG.EMBEDDING_DIMENSIONS,
    }),
    signal: AbortSignal.timeout(VECTOR_CONFIG.GEMINI_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = createEmbeddingError(
      `Gemini embedding request failed: ${response.status} ${body.slice(0, 500)}`,
      response.status,
    );
    error.retryable = RETRYABLE_STATUSES.has(response.status);
    error.retryAfter = response.headers.get("retry-after");
    throw error;
  }

  return response.json();
}

/**
 * Embed a single text and return its vector.
 *
 * Deliberately one text per call. Passing multiple inputs to
 * gemini-embedding-2 in a single request yields ONE aggregated embedding
 * rather than one per input, which would silently write a blended vector to
 * every document instead of failing loudly.
 */
async function embedText(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw createEmbeddingError("Embedding input must be a non-empty string");
  }

  if (!VECTOR_CONFIG.GEMINI_API_KEY) {
    throw createEmbeddingError("GEMINI_API_KEY is not configured");
  }

  let lastError = null;

  for (let attempt = 0; attempt <= VECTOR_CONFIG.GEMINI_MAX_RETRIES; attempt += 1) {
    try {
      debugLog("gemini.embed.start", {
        attempt,
        model: VECTOR_CONFIG.EMBEDDING_MODEL,
        inputLength: text.length,
      });

      const payload = await requestEmbedding(text);
      const values = payload?.embedding?.values;

      if (!Array.isArray(values) || values.length === 0) {
        throw createEmbeddingError(
          "Gemini embedding response contained no vector",
        );
      }

      // A dimension mismatch means the vector can never match the Atlas index,
      // so fail here rather than writing an unsearchable document.
      if (values.length !== VECTOR_CONFIG.EMBEDDING_DIMENSIONS) {
        throw createEmbeddingError(
          `Gemini returned ${values.length} dimensions, expected ${VECTOR_CONFIG.EMBEDDING_DIMENSIONS}`,
        );
      }

      debugLog("gemini.embed.success", { attempt, dimensions: values.length });
      return values;
    } catch (error) {
      lastError = error;

      const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";
      const isRetryable = error?.retryable === true || isTimeout;
      const hasAttemptsLeft = attempt < VECTOR_CONFIG.GEMINI_MAX_RETRIES;

      if (!isRetryable || !hasAttemptsLeft) {
        break;
      }

      const delayMs = computeBackoffMs(attempt, error?.retryAfter);
      debugLog("gemini.embed.retry", {
        attempt,
        status: error?.status ?? null,
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  console.error("gemini.embed.error", {
    message: lastError?.message,
    status: lastError?.status ?? null,
  });
  debugLog("gemini.embed.error", { error: serializeError(lastError) });

  if (lastError?.name === "RateLimitError" || lastError?.name === "EmbeddingError") {
    throw lastError;
  }

  throw createEmbeddingError(
    `Gemini embedding failed: ${lastError?.message || "unknown error"}`,
  );
}

module.exports = {
  embedText,
};
