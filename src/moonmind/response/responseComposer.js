const { createChatCompletion } = require("../adapters/openaiClient");
const { debugLog } = require("../utils/debug");

const RESPONSE_MODEL = process.env.MOONMIND_RESPONSE_MODEL || "gpt-4o-mini";
const GREETING_MODEL = process.env.MOONMIND_GREETING_MODEL || RESPONSE_MODEL;
const FACTUAL_MODEL = process.env.MOONMIND_FACTUAL_MODEL || RESPONSE_MODEL;

function buildGreetingPrompt(prompt) {
  return [
    {
      role: "system",
      content: [
        "You are a friendly greeting assistant.",
        "Return a brief, friendly, lightly witty greeting only.",
        "Limit to 1-2 sentences.",
        "No extra commentary.",
      ].join(" "),
    },
    {
      role: "user",
      content: prompt,
    },
  ];
}

function buildFactualPrompt(prompt) {
  return [
    {
      role: "system",
      content: [
        "You answer technical, scientific, or software factual questions.",
        "Be short, non-opinionated, and 1-2 sentences.",
        "If the prompt is not a tech/science/software factual question, respond with 'unknown'.",
      ].join(" "),
    },
    {
      role: "user",
      content: prompt,
    },
  ];
}

function buildGroundedPrompt(intentReport, retrievalResult, style) {
  const styleGuide = {
    grounded: "Provide a concise, grounded response.",
    documents:
      "Provide a brief answer that references the retrieved documents.",
    summary: "Provide a concise summary of the requested aspect.",
  };

  return [
    {
      role: "system",
      content: [
        "You are a grounded response composer.",
        "Use ONLY the provided data payload.",
        "If data is insufficient, respond with 'unknown'.",
        "Return plain text only.",
        styleGuide[style] ?? styleGuide.grounded,
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          primary_intent: intentReport.primary_intent,
          subtype: intentReport.subtype,
          domains: intentReport.domains,
          data: retrievalResult.items,
        },
        null,
        2,
      ),
    },
  ];
}

async function composeGreeting(prompt) {
  debugLog("response.composeGreeting.start", {
    model: GREETING_MODEL,
    promptLength: typeof prompt === "string" ? prompt.length : 0,
  });
  const messages = buildGreetingPrompt(prompt);
  const completion = await createChatCompletion({
    model: GREETING_MODEL,
    messages,
    temperature: 0.7,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  debugLog("response.composeGreeting.success", {
    hasContent: Boolean(content),
  });
  return content || "Hello!";
}

async function composeFactual(prompt) {
  debugLog("response.composeFactual.start", {
    model: FACTUAL_MODEL,
    promptLength: typeof prompt === "string" ? prompt.length : 0,
  });
  const messages = buildFactualPrompt(prompt);
  const completion = await createChatCompletion({
    model: FACTUAL_MODEL,
    messages,
    temperature: 0,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  debugLog("response.composeFactual.success", {
    hasContent: Boolean(content),
  });
  return content || "unknown";
}

async function composeGroundedResponse(intentReport, retrievalResult, style) {
  debugLog("response.composeGrounded.start", {
    model: RESPONSE_MODEL,
    style,
    itemCount: retrievalResult?.items?.length ?? 0,
    subtype: intentReport?.subtype,
  });
  const messages = buildGroundedPrompt(intentReport, retrievalResult, style);
  const completion = await createChatCompletion({
    model: RESPONSE_MODEL,
    messages,
    temperature: 0,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  debugLog("response.composeGrounded.success", {
    hasContent: Boolean(content),
  });
  return content || "unknown";
}

module.exports = {
  composeGreeting,
  composeFactual,
  composeGroundedResponse,
};
