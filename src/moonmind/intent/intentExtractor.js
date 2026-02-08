const { createChatCompletion } = require("../adapters/openaiClient");
const { INTENT_REPORT_VERSION } = require("./intentReportSchema");

const INTENT_MODEL = process.env.MOONMIND_INTENT_MODEL || "gpt-4o-mini";

function buildIntentPrompt({ prompt, requestId, sessionId }) {
  return [
    {
      role: "system",
      content: [
        "You are a deterministic intent extraction engine.",
        "Return ONLY a JSON object that matches the provided schema.",
        "Never include markdown or extra keys.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Request ID: ${requestId}`,
        `Session ID: ${sessionId ?? "null"}`,
        `User prompt: ${prompt}`,
        "Schema requirements:",
        "- version must be 1.0",
        "- intent must be one of github_stats, leetcode_stats, portfolio_docs, capabilities, out_of_scope, unknown",
        "- entities.githubUsername and entities.leetcodeUsername can be null",
        "- dataSources must list required sources",
        "- constraints.limit must be null or positive integer",
        "- response.mode must be raw, grounded, or unknown",
        "- response.format must be json or text",
        "- safety.outOfScope must be true only for non-portfolio requests",
      ].join("\n"),
    },
  ];
}

async function extractIntent({ prompt, requestId, sessionId }) {
  const messages = buildIntentPrompt({ prompt, requestId, sessionId });
  const completion = await createChatCompletion({
    model: INTENT_MODEL,
    messages,
    responseFormat: { type: "json_object" },
    temperature: 0,
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Intent model returned empty response");
  }

  const report = JSON.parse(content);
  report.version = INTENT_REPORT_VERSION;
  report.requestId = requestId;
  report.sessionId = sessionId ?? null;
  return report;
}

module.exports = {
  extractIntent,
};
