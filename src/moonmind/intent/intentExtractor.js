const { createChatCompletion } = require("../adapters/openaiClient");
const {
  INTENT_REPORT_VERSION,
  intentReportSchema,
} = require("./intentReportSchema");

const INTENT_MODEL = process.env.MOONMIND_INTENT_MODEL || "gpt-4o-mini";

function buildIntentPrompt({ prompt, requestId, sessionId }) {
  const schemaJson = JSON.stringify(intentReportSchema, null, 2);
  return [
    {
      role: "system",
      content: [
        "You are a deterministic intent extraction engine.",
        "Return ONLY a JSON object that matches the provided schema.",
        "Do not answer the user, do not explain, do not add text.",
        "Schema violations are fatal. Do not include markdown or extra keys.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Request ID: ${requestId}`,
        `Session ID: ${sessionId ?? "null"}`,
        `User prompt: ${prompt}`,
        "Intent rules:",
        "- Use intent \"out_of_scope\" only for requests unrelated to portfolio data.",
        "- Use intent \"unknown\" when intent is ambiguous or cannot be determined.",
        "- If intent is github_stats, include dataSources: [\"mongo_github_stats\"].",
        "- If intent is leetcode_stats, include dataSources: [\"leetcode_graphql\"].",
        "- If intent is portfolio_docs, include dataSources: [\"mongo_vector_docs\"].",
        "- If intent is capabilities, dataSources must be [].",
        "- If intent is out_of_scope, safety.outOfScope must be true and include reasons.",
        "- If intent is unknown, safety.outOfScope must be false.",
        "Response rules:",
        "- response.mode must be raw for structured data requests, grounded for summaries, unknown for missing data.",
        "- response.format must be json for raw, text for grounded or unknown.",
        "JSON Schema (verbatim):",
        schemaJson,
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
