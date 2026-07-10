const crypto = require("crypto");
const { extractIntent } = require("./intentExtractor");
const { retrieveDocuments } = require("./retrievalEngine");
const { rankDocuments } = require("./ranker");
const { rerankDocuments } = require("./ranking/llmReranker");
const { decomposeQuery } = require("./planning/queryDecomposer");
const { generateResponse } = require("./responseGenerator");
const { MoonMindError } = require("./utils/errors");
const { debugLog, serializeError } = require("./utils/debug");
const { detectStatsQuery } = require("./statsRouter");
const { getGithubStats, getLeetcodeStats } = require("./statsService");
const VECTOR_CONFIG = require("../../config/vectorConfig");

const FINAL_DOCUMENT_LIMIT = 5;

function buildResponseDocuments(documents = []) {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents.map((document) => {
    const { summary_for_embedding, ...responseDocument } = document || {};
    return {
      ...responseDocument,
      content_full: Object.prototype.hasOwnProperty.call(
        responseDocument,
        "content_full",
      )
        ? responseDocument.content_full
        : null,
    };
  });
}

// Union the fused results of several sub-queries, deduping by id. A document
// relevant to multiple sub-questions accumulates RRF score (desirable), and we
// keep the highest semantic score and the richest (content-bearing) copy.
function unionDocuments(groups) {
  const merged = new Map();

  groups.forEach((documents) => {
    (documents || []).forEach((document) => {
      if (document == null || document.id == null) {
        return;
      }

      const id = String(document.id);
      const existing = merged.get(id);

      if (!existing) {
        merged.set(id, { ...document });
        return;
      }

      const nextRrf = (existing.rrf_score || 0) + (document.rrf_score || 0);
      const nextSemantic = Math.max(
        existing.semantic_score || 0,
        document.semantic_score || 0,
      );
      const base =
        !existing.content_full && document.content_full ? document : existing;

      merged.set(id, {
        ...base,
        rrf_score: nextRrf,
        semantic_score: nextSemantic,
      });
    });
  });

  return Array.from(merged.values());
}

// Full retrieval sub-flow: optional decomposition -> per-(sub)query intent +
// retrieval -> union -> rank (with semantic gate) -> optional LLM rerank.
async function retrieveAndRank({ query, sessionId, metadata, requestId }) {
  const subqueries = VECTOR_CONFIG.DECOMPOSE_ENABLED
    ? await decomposeQuery({ query, requestId })
    : [query];

  const perSubquery = await Promise.all(
    subqueries.map(async (subquery) => {
      const intentPayload = await extractIntent({
        query: subquery,
        requestId,
        sessionId,
      });

      debugLog("moonmind.pipeline.plan", {
        requestId,
        subquery,
        retrieval_plan: intentPayload.retrieval_plan,
        entities: intentPayload.entities,
      });

      const result = await retrieveDocuments({
        query: subquery,
        intentPayload,
        metadata,
        limit: VECTOR_CONFIG.VECTOR_SEARCH_LIMIT,
      });

      return { intent: intentPayload.intent, documents: result.documents };
    }),
  );

  const primaryIntent = perSubquery[0]?.intent || "question";
  const unioned =
    subqueries.length > 1
      ? unionDocuments(perSubquery.map((entry) => entry.documents))
      : perSubquery[0]?.documents || [];

  // When reranking, keep a wider candidate pool for the reranker to reorder.
  const candidateLimit = VECTOR_CONFIG.RERANK_ENABLED
    ? Math.max(VECTOR_CONFIG.RERANK_CANDIDATES, FINAL_DOCUMENT_LIMIT)
    : FINAL_DOCUMENT_LIMIT;

  const ranked = rankDocuments(unioned, candidateLimit);

  const finalDocuments = VECTOR_CONFIG.RERANK_ENABLED
    ? await rerankDocuments({
        query,
        documents: ranked,
        limit: FINAL_DOCUMENT_LIMIT,
      })
    : ranked.slice(0, FINAL_DOCUMENT_LIMIT);

  debugLog("moonmind.pipeline.ranking", {
    requestId,
    subqueryCount: subqueries.length,
    reranked: VECTOR_CONFIG.RERANK_ENABLED,
    rankedDocuments: finalDocuments.map((document) => ({
      id: document.id,
      score: document.score,
    })),
  });

  return { documents: finalDocuments, intent: primaryIntent };
}

async function runMoonMindPipeline({ query, sessionId, metadata = {} }) {
  const requestId = crypto.randomUUID();

  if (typeof query !== "string" || query.trim().length === 0) {
    throw new MoonMindError("Prompt is required", { code: "INVALID_INPUT" });
  }

  const trimmedQuery = query.trim();

  debugLog("moonmind.pipeline.query", {
    requestId,
    sessionId: sessionId ?? null,
    query: trimmedQuery,
  });

  try {
    const statsRoute = detectStatsQuery(trimmedQuery);
    let statsPayload = null;

    if (statsRoute.isGithub || statsRoute.isLeetcode) {
      const statsType = statsRoute.isGithub ? "github_stats" : "leetcode_stats";
      debugLog("moonmind.pipeline.stats_route.triggered", {
        requestId,
        statsType,
        isPureStats: statsRoute.isPureStats,
      });

      try {
        const statsData = statsRoute.isGithub
          ? await getGithubStats()
          : await getLeetcodeStats();
        statsPayload = { type: statsType, data: statsData };
        debugLog("moonmind.pipeline.stats_route.fetch_success", {
          requestId,
          statsType,
        });
      } catch (statsError) {
        debugLog("moonmind.pipeline.stats_route.fetch_failure", {
          requestId,
          statsType,
          error: serializeError(statsError),
        });

        // Pure stats query with no docs to fall back on: keep prior behaviour.
        if (statsRoute.isPureStats) {
          return {
            status: "success",
            data: {
              summary: "Unable to fetch stats at the moment",
              documents: [],
            },
          };
        }
        // Mixed query: degrade gracefully to a docs-only answer.
        statsPayload = null;
      }

      // Pure stats query: bypass retrieval entirely, as before.
      if (statsRoute.isPureStats) {
        debugLog("moonmind.pipeline.final_response_trigger", {
          requestId,
          documentCount: 0,
          statsType,
        });

        const summary = await generateResponse({
          query: trimmedQuery,
          documents: [],
          intent: "stats_query",
          statsPayload,
        });

        return {
          status: "success",
          data: { summary, documents: [] },
        };
      }
      // Mixed stats + portfolio query: fall through and retrieve documents too.
    }

    const { documents: rankedDocuments, intent } = await retrieveAndRank({
      query: trimmedQuery,
      sessionId,
      metadata,
      requestId,
    });

    debugLog("moonmind.pipeline.final_response_trigger", {
      requestId,
      documentCount: rankedDocuments.length,
      hasStatsPayload: Boolean(statsPayload),
    });

    const summary = await generateResponse({
      query: trimmedQuery,
      documents: rankedDocuments,
      intent: statsPayload ? "stats_query" : intent,
      statsPayload,
    });

    return {
      status: "success",
      data: {
        summary,
        documents: buildResponseDocuments(rankedDocuments),
      },
    };
  } catch (error) {
    debugLog("moonmind.pipeline.error", {
      requestId,
      error: serializeError(error),
    });
    throw error;
  }
}

module.exports = {
  buildResponseDocuments,
  runMoonMindPipeline,
};
