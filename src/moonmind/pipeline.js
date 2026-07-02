const crypto = require("crypto");
const { extractIntent } = require("./intentExtractor");
const { retrieveDocuments } = require("./retrievalEngine");
const { rankDocuments } = require("./ranker");
const { generateResponse } = require("./responseGenerator");
const { MoonMindError } = require("./utils/errors");
const { debugLog, serializeError } = require("./utils/debug");
const { detectStatsQuery } = require("./statsRouter");
const { getGithubStats, getLeetcodeStats } = require("./statsService");

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

    if (statsRoute.isGithub || statsRoute.isLeetcode) {
      const statsType = statsRoute.isGithub ? "github_stats" : "leetcode_stats";
      debugLog("moonmind.pipeline.stats_route.triggered", {
        requestId,
        statsType,
      });

      try {
        const statsData = statsRoute.isGithub
          ? await getGithubStats()
          : await getLeetcodeStats();

        debugLog("moonmind.pipeline.stats_route.fetch_success", {
          requestId,
          statsType,
        });

        debugLog("moonmind.pipeline.final_response_trigger", {
          requestId,
          documentCount: 0,
          statsType,
        });

        const summary = await generateResponse({
          query: trimmedQuery,
          documents: [],
          intent: "stats_query",
          statsPayload: {
            type: statsType,
            data: statsData,
          },
        });

        return {
          status: "success",
          data: {
            summary,
            documents: [],
          },
        };
      } catch (statsError) {
        debugLog("moonmind.pipeline.stats_route.fetch_failure", {
          requestId,
          statsType,
          error: serializeError(statsError),
        });

        return {
          status: "success",
          data: {
            summary: "Unable to fetch stats at the moment",
            documents: [],
          },
        };
      }
    }

    const intentPayload = await extractIntent({
      query: trimmedQuery,
      requestId,
      sessionId,
    });

    debugLog("moonmind.pipeline.plan", {
      requestId,
      retrieval_plan: intentPayload.retrieval_plan,
      entities: intentPayload.entities,
    });

    const retrievalResult = await retrieveDocuments({
      query: trimmedQuery,
      intentPayload,
      metadata,
      limit: 10,
    });

    const rankedDocuments = rankDocuments(retrievalResult.documents, 5);

    debugLog("moonmind.pipeline.ranking", {
      requestId,
      rankedDocuments: rankedDocuments.map((document) => ({
        id: document.id,
        score: document.score,
      })),
    });

    debugLog("moonmind.pipeline.final_response_trigger", {
      requestId,
      documentCount: rankedDocuments.length,
    });

    const summary = await generateResponse({
      query: trimmedQuery,
      documents: rankedDocuments,
      intent: intentPayload.intent,
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
