const crypto = require("crypto");
const { extractIntent } = require("./intentExtractor");
const { retrieveDocuments } = require("./retrievalEngine");
const { rankDocuments } = require("./ranker");
const { generateResponse } = require("./responseGenerator");
const { MoonMindError } = require("./utils/errors");
const { debugLog, serializeError } = require("./utils/debug");

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
        documents: rankedDocuments,
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
  runMoonMindPipeline,
};
