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
        "Your sole task is to translate a user prompt into a JSON object that EXACTLY matches the provided schema.",
        "You must NEVER answer the user directly, explain your reasoning, or include any text outside the JSON object.",
        "All fields must strictly follow the schema: no extra keys, no missing keys, no type deviations.",
        "Schema violations are fatal and must not be worked around.",
        "You may only generate natural language inside the `message` field, and only under the explicit rules provided.",
        "The `message` field is a brief courtesy response only and must never contain authoritative, exhaustive, instructional, or creative content.",
        "Never generate long-form answers, tutorials, opinions, or speculative statements.",
        'If uncertain, prefer intent = "unknown" rather than guessing.',
        "Output must be valid JSON only. Do not use markdown.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Request ID: ${requestId}`,
        `Session ID: ${sessionId ?? "null"}`,
        `User prompt: ${prompt}`,
        "",
        "INTENT CLASSIFICATION RULES:",
        '- Use intent "github_stats" for requests about GitHub statistics or activity.',
        '- Use intent "leetcode_stats" for requests about LeetCode statistics or activity.',
        '- Use intent "portfolio_docs" for requests that require searching portfolio documents.',
        '- Use intent "capabilities" for questions about skills, experience, or abilities.',
        '- Use intent "certifications" for questions about certifications or courses completed.',
        '- Use intent "out_of_scope" ONLY for requests unrelated to portfolio, GitHub, LeetCode, software, science, or technology.',
        '- Use intent "unknown" when intent is ambiguous or cannot be confidently determined.',
        "",
        "DATA SOURCE RULES:",
        '- If intent is "github_stats", dataSources MUST be ["mongo_github_stats"].',
        '- If intent is "leetcode_stats", dataSources MUST be ["leetcode_graphql"].',
        '- If intent is "portfolio_docs", dataSources MUST be ["mongo_vector_docs"].',
        '- If intent is "capabilities", dataSources MUST be [].',
        '- If intent is "unknown" or "out_of_scope", dataSources MUST be [].',
        "",
        "SAFETY RULES:",
        '- safety.outOfScope MUST be true ONLY when intent = "out_of_scope".',
        "- safety.reasons MUST be non-empty ONLY when safety.outOfScope = true.",
        '- If intent = "unknown", safety.outOfScope MUST be false and reasons MUST be empty.',
        "",
        "MESSAGE RULES:",
        "- Greetings (e.g. hi, hello, hey) MUST always be acknowledged with a short, friendly greeting.",
        '- If intent is "out_of_scope" or "unknown" (and not a greeting), message MUST be a short, polite, professional, lightly witty denial.',
        "- For general technical, scientific, or software-related questions, message MAY contain a concise 1–2 sentence, high-level, non-opinionated response.",
        "- If none of the above apply, message MUST be an empty string.",
        "",
        "RESPONSE RULES:",
        '- response.mode MUST be "raw" for structured data requests.',
        '- response.mode MUST be "grounded" for brief factual summaries.',
        '- response.mode MUST be "unknown" when intent is unknown or out_of_scope.',
        '- response.format MUST be "json" when response.mode = "raw".',
        '- response.format MUST be "text" when response.mode = "grounded" or "unknown".',
        "",
        "JSON SCHEMA (VERBATIM — MUST MATCH EXACTLY):",
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
