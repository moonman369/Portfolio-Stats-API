// Portfolio-intent trigger words. If a stats query ALSO contains any of these,
// it is a mixed prompt (e.g. "my github stats and my projects") and must not
// short-circuit retrieval — the pipeline should answer with stats AND docs.
const PORTFOLIO_INTENT_PATTERN =
  /\b(skills?|tech\s*stack|projects?|experiences?|work|role|certifications?|certificates?|education|degree|university|college|achievements?|awards?|research|papers?|publications?|hobbies?|interests?|about\s+(?:me|him|ayan)|who\s+is|tell\s+me\s+about)\b/i;

function detectStatsQuery(prompt) {
  const normalizedPrompt =
    typeof prompt === "string" ? prompt.toLowerCase().trim() : "";

  if (!normalizedPrompt) {
    return { isGithub: false, isLeetcode: false, isPureStats: false };
  }

  const hasGithubKeyword = normalizedPrompt.includes("github");
  const hasLeetcodeKeyword = normalizedPrompt.includes("leetcode");
  const hasStatsIntent =
    normalizedPrompt.includes("stats") ||
    normalizedPrompt.includes("profile") ||
    normalizedPrompt.includes("moonman") ||
    normalizedPrompt.includes("ayan");

  const isGithub = hasGithubKeyword && hasStatsIntent;
  const isLeetcode = hasLeetcodeKeyword && hasStatsIntent;

  // Pure stats = a stats query with no additional portfolio intent, so it is
  // safe to bypass retrieval entirely.
  const isPureStats =
    (isGithub || isLeetcode) &&
    !PORTFOLIO_INTENT_PATTERN.test(normalizedPrompt);

  return {
    isGithub,
    isLeetcode,
    isPureStats,
  };
}

module.exports = {
  detectStatsQuery,
};
