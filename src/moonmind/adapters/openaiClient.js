const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com";

async function requestOpenAI(path, body) {
  const response = await fetch(`${OPENAI_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${message}`);
  }

  return response.json();
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
