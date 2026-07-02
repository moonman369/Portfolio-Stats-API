function detectStatsQuery(prompt) {
  const normalizedPrompt =
    typeof prompt === "string" ? prompt.toLowerCase().trim() : "";

  if (!normalizedPrompt) {
    return { isGithub: false, isLeetcode: false };
  }

  const hasGithubKeyword = normalizedPrompt.includes("github");
  const hasLeetcodeKeyword = normalizedPrompt.includes("leetcode");
  const hasStatsIntent =
    normalizedPrompt.includes("stats") ||
    normalizedPrompt.includes("profile") ||
    normalizedPrompt.includes("moonman") ||
    normalizedPrompt.includes("ayan");

  return {
    isGithub: hasGithubKeyword && hasStatsIntent,
    isLeetcode: hasLeetcodeKeyword && hasStatsIntent,
  };
}

module.exports = {
  detectStatsQuery,
};
