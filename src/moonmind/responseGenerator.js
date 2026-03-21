const { createChatCompletion } = require("./adapters/openaiClient");
const { debugLog } = require("./utils/debug");

const RESPONSE_MODEL = process.env.MOONMIND_RESPONSE_MODEL || "gpt-4o-mini";

function buildMessages({ query, documents, intent }) {
  return [
    {
      role: "system",
      content: [
        "You are MoonMind, a portfolio-grounded assistant.",
        "Use only the provided documents.",
        "Do not hallucinate or add facts not present in the documents.",
        "If no useful documents are provided, explicitly say that no supporting MoonMind data was found.",
        `The user intent is: ${intent}.`,
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({ query, documents }, null, 2),
    },
  ];
}

async function generateResponse({ query, documents, intent }) {
  debugLog("moonmind.response.start", {
    intent,
    documentCount: Array.isArray(documents) ? documents.length : 0,
  });

  if (!Array.isArray(documents) || documents.length === 0) {
    return "I could not find supporting MoonMind data for that request.";
  }

  const completion = await createChatCompletion({
    model: RESPONSE_MODEL,
    messages: buildMessages({ query, documents, intent }),
    temperature: 0,
  });

  const summary = completion?.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new Error("MoonMind response generator returned empty content");
  }

  debugLog("moonmind.response.complete", {
    intent,
    documentCount: documents.length,
  });

  return summary;
}

module.exports = {
  generateResponse,
};
