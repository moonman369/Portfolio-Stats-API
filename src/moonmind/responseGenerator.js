const { createChatCompletion } = require("./adapters/openaiClient");
const { debugLog } = require("./utils/debug");
const { sanitizeDocumentsForLLM } = require("./documentSanitizer");

const RESPONSE_MODEL = process.env.MOONMIND_RESPONSE_MODEL || "gpt-4o-mini";

function buildMessages({ query, documents, intent }) {
  const systemPrompt = [
    "You are a professional AI assistant representing Ayan (also known as Moonman, Moonman369, MightyAyan, Mr. Maiti, Ayan Maiti).",
    "Your job is to generate clear, polished, human-friendly responses using only the provided documents.",
    "STRICT RULES:",
    "- Do NOT mention internal scores like impact_score.",
    "- Do NOT mention ranking, embeddings, or retrieval process.",
    "- Do NOT expose metadata field names or internal JSON structure.",
    "- Do NOT hallucinate or add facts not present in the documents.",
    "- If no useful documents are provided, clearly state that no relevant information was found.",
    "FORMAT RULES:",
    "- Use clean markdown.",
    "- Use bullet points or numbered lists where appropriate.",
    "- Keep the response concise but insightful.",
    "- Highlight key strengths clearly.",
    "- If listing items, use bold item titles followed by a short explanation.",
    `Current user intent: ${intent}.`,
  ].join("\n");

  const payload = {
    query,
    documents,
  };

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: JSON.stringify(payload, null, 2),
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

  debugLog("moonmind.response.sanitization.before", {
    documentCount: documents.length,
    sampleDocument: documents[0] || null,
  });

  const sanitizedDocuments = sanitizeDocumentsForLLM(documents);

  debugLog("moonmind.response.sanitization.after", {
    documentCount: sanitizedDocuments.length,
    sampleDocument: sanitizedDocuments[0] || null,
  });

  const messages = buildMessages({
    query,
    documents: sanitizedDocuments,
    intent,
  });

  debugLog("moonmind.response.prompt", {
    model: RESPONSE_MODEL,
    systemPrompt: messages[0]?.content || "",
    userPayloadPreview: messages[1]?.content || "",
  });

  const completion = await createChatCompletion({
    model: RESPONSE_MODEL,
    messages,
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
