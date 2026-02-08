const { createChatCompletion } = require("../adapters/openaiClient");

const RESPONSE_MODEL = process.env.MOONMIND_RESPONSE_MODEL || "gpt-4o-mini";

function buildResponsePrompt(intentReport, retrievalResult) {
  return [
    {
      role: "system",
      content: [
        "You are a grounded response composer.",
        "Use ONLY the provided data payload.",
        "If data is insufficient, respond with 'unknown'.",
        "Return plain text only.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          intent: intentReport.intent,
          query: intentReport.query,
          data: retrievalResult.items,
        },
        null,
        2,
      ),
    },
  ];
}

async function composeGroundedResponse(intentReport, retrievalResult) {
  const messages = buildResponsePrompt(intentReport, retrievalResult);
  const completion = await createChatCompletion({
    model: RESPONSE_MODEL,
    messages,
    temperature: 0,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  return content || "unknown";
}

module.exports = {
  composeGroundedResponse,
};
