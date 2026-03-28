const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const { debugLog, serializeError } = require("../utils/debug");

async function requestOpenAI(path, body) {
  const url = `${OPENAI_BASE_URL}${path}`;
  debugLog("openai.request.start", {
    path,
    url,
    model: body?.model,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await response.text();
      debugLog("openai.request.non_ok", {
        path,
        status: response.status,
        bodyPreview: message.slice(0, 500),
      });
      throw new Error(`OpenAI request failed: ${response.status} ${message}`);
    }

    debugLog("openai.request.success", {
      path,
      status: response.status,
    });
    return response.json();
  } catch (error) {
    console.error("openai.request.error", {
      path,
      message: error?.message,
      stack: error?.stack,
    });
    debugLog("openai.request.error", {
      path,
      error: serializeError(error),
    });
    throw error;
  }
}

async function createChatCompletion({ model, messages, responseFormat, temperature }) {
  return requestOpenAI("/v1/chat/completions", {
    model,
    messages,
    temperature,
    response_format: responseFormat,
  });
}

async function createEmbedding({ model, input }) {
  return requestOpenAI("/v1/embeddings", {
    model,
    input,
  });
}

module.exports = {
  createChatCompletion,
  createEmbedding,
};
