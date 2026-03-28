const { createChatCompletion } = require("../adapters/openaiClient");
const { MoonMindError } = require("../utils/errors");
const { debugLog } = require("../utils/debug");

const RESPONSE_MODEL = process.env.MOONMIND_RESPONSE_MODEL || "gpt-4o-mini";
const GREETING_MODEL = process.env.MOONMIND_GREETING_MODEL || RESPONSE_MODEL;
const FACTUAL_MODEL = process.env.MOONMIND_FACTUAL_MODEL || RESPONSE_MODEL;

async function runTextCompletion({ model, messages, temperature }) {
  const completion = await createChatCompletion({
    model,
    messages,
    temperature,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new MoonMindError("LLM returned empty content", { code: "EMPTY_LLM_RESPONSE" });
  }

  return content;
}

async function composeGreeting(prompt) {
  debugLog("response.composeGreeting.start", { model: GREETING_MODEL });
  return runTextCompletion({
    model: GREETING_MODEL,
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content:
          "You are a friendly greeting assistant. Return a brief, witty greeting in 1-2 sentences.",
      },
      { role: "user", content: prompt },
    ],
  });
}

async function composeFactual(prompt) {
  debugLog("response.composeFactual.start", { model: FACTUAL_MODEL });
  return runTextCompletion({
    model: FACTUAL_MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Answer the user's factual technical question clearly and concisely in under 120 words.",
      },
      { role: "user", content: prompt },
    ],
  });
}

async function composeStatsResponse(prompt, statsPayload) {
  return runTextCompletion({
    model: RESPONSE_MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Format the provided stats into a concise, readable response. Use only provided numbers.",
      },
      {
        role: "user",
        content: JSON.stringify({ prompt, stats: statsPayload }, null, 2),
      },
    ],
  });
}

async function composeGroundedResponse({ prompt, documents, objective }) {
  return runTextCompletion({
    model: RESPONSE_MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: [
          "You are a portfolio-grounded assistant.",
          "Use only the retrieved documents.",
          "Do not invent facts.",
          "If retrieved data is insufficient, explicitly say the data is insufficient.",
          `Objective: ${objective}.`,
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({ prompt, documents }, null, 2),
      },
    ],
  });
}

module.exports = {
  composeGreeting,
  composeFactual,
  composeStatsResponse,
  composeGroundedResponse,
};
