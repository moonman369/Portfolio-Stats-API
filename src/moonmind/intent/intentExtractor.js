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
        "INTENT CATEGORY RULES (MUST PICK EXACTLY ONE):",
        '- intentCategory = "greeting" for greetings, salutations, or pleasantries.',
        '- intentCategory = "question" for information-seeking prompts.',
        '- intentCategory = "action" for requests to fetch documents or summarize aspects.',
        "",
        "INTENT SUBTYPE RULES:",
        '- For greetings, intentSubtype = "general_greeting".',
        '- For technical/scientific/software factual questions (non-opinionated), intentSubtype = "factual".',
        '- For credentials inquiries, intentSubtype = "credentials".',
        '- For skills inquiries, intentSubtype = "skills".',
        '- For experience inquiries, intentSubtype = "experiences".',
        '- For strengths/weaknesses inquiries, intentSubtype = "strengths_weaknesses".',
        '- For GitHub stats questions, intentSubtype = "stats_github".',
        '- For LeetCode stats questions, intentSubtype = "stats_leetcode".',
        '- For unsupported or out-of-scope questions, intentSubtype = "unsupported".',
        '- For document fetch actions, intentSubtype = "fetch_documents".',
        '- For summarize aspect actions, intentSubtype = "summarize_aspect".',
        "",
        "EXECUTION RULES:",
        '- execution.retrieval = "none" for greeting, factual, or unsupported.',
        '- execution.retrieval = "github_stats" for stats_github.',
        '- execution.retrieval = "leetcode_stats" for stats_leetcode.',
        '- execution.retrieval = "full_search" for credentials, skills, experiences, strengths_weaknesses, fetch_documents, summarize_aspect.',
        '- execution.responseStyle = "greeting" for greetings.',
        '- execution.responseStyle = "factual" for factual questions.',
        '- execution.responseStyle = "denial" for unsupported.',
        '- execution.responseStyle = "grounded" for credentials, skills, experiences, strengths_weaknesses, stats_github, stats_leetcode.',
        '- execution.responseStyle = "documents" for fetch_documents.',
        '- execution.responseStyle = "summary" for summarize_aspect.',
        '- execution.allowLLM must be true for greeting, factual, grounded, documents, summary; false for denial.',
        "",
        "DATA SOURCE RULES:",
        '- If execution.retrieval = "github_stats", dataSources MUST be ["mongo_github_stats"].',
        '- If execution.retrieval = "leetcode_stats", dataSources MUST be ["leetcode_graphql"].',
        '- If execution.retrieval = "full_search", dataSources MUST be ["mongo_vector_docs"].',
        '- If execution.retrieval = "none", dataSources MUST be [].',
        "",
        "SAFETY RULES:",
        '- safety.outOfScope MUST be true ONLY when intentSubtype = "unsupported" due to being out-of-scope.',
        "- safety.reasons MUST be non-empty ONLY when safety.outOfScope = true.",
        '- If intentSubtype != "unsupported", safety.outOfScope MUST be false and reasons MUST be empty.',
        "",
        "MESSAGE RULES:",
        '- message MUST be a short, polite, professional, lightly witty denial only when intentSubtype = "unsupported".',
        '- message MUST be an empty string for all other subtypes (including greetings and factual).',
        "",
        "QUERY RULES:",
        '- query and semanticQuery MUST be concise, retrieval-ready summaries of the user prompt.',
        '- keywords MUST be a focused list of 1-6 search terms or an empty array when not applicable.',
        '- filters.topics may mirror entities.topics. filters.documentTypes should be inferred only when explicit.',
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
