const axios = require("axios");
const { getStats } = require("../../../mongo");
const { fullSearch } = require("./fullSearch");
const { debugLog, serializeError } = require("../utils/debug");

async function fetchGithubStats() {
  debugLog("retrieval.github.start");
  const stats = await getStats();
  if (!stats?.stats) {
    debugLog("retrieval.github.missing");
    return { type: "github_stats", items: [], missing: true };
  }
  debugLog("retrieval.github.success");
  return { type: "github_stats", items: [stats], missing: false };
}

async function fetchLeetcodeStats(username) {
  debugLog("retrieval.leetcode.start", { username: username ?? null });
  if (!username) {
    debugLog("retrieval.leetcode.missing_username");
    return { type: "leetcode_stats", items: [], missing: true };
  }

  const endpoint = "https://leetcode.com/graphql/";
  const statsQuery = `query userSessionProgress($username: String!) {
    allQuestionsCount { difficulty count }
    matchedUser(username: $username) {
      submitStats {
        acSubmissionNum { difficulty count submissions }
      }
    }
  }`;
  const rankingQuery = `query userPublicProfile($username: String!) {
    matchedUser(username: $username) {
      profile { ranking }
    }
  }`;

  let response;
  let rankingResponse;
  try {
    [response, rankingResponse] = await Promise.all([
      axios.post(endpoint, {
        query: statsQuery,
        variables: { username },
        operationName: "userSessionProgress",
      }),
      axios.post(endpoint, {
        query: rankingQuery,
        variables: { username },
        operationName: "userPublicProfile",
      }),
    ]);
  } catch (error) {
    debugLog("retrieval.leetcode.request.error", {
      error: serializeError(error),
    });
    throw error;
  }

  const data = response.data?.data;
  const ranking = rankingResponse.data?.data;

  if (!data?.matchedUser || !ranking?.matchedUser) {
    debugLog("retrieval.leetcode.missing_data", {
      hasData: Boolean(data?.matchedUser),
      hasRanking: Boolean(ranking?.matchedUser),
    });
    return { type: "leetcode_stats", items: [], missing: true };
  }

  const payload = {
    status: "success",
    totalSolved: data.matchedUser.submitStats.acSubmissionNum[0].count,
    totalQuestions: data.allQuestionsCount[0].count,
    easySolved: data.matchedUser.submitStats.acSubmissionNum[1].count,
    totalEasy: data.allQuestionsCount[1].count,
    mediumSolved: data.matchedUser.submitStats.acSubmissionNum[2].count,
    totalMedium: data.allQuestionsCount[2].count,
    hardSolved: data.matchedUser.submitStats.acSubmissionNum[3].count,
    totalHard: data.allQuestionsCount[3].count,
    ranking: ranking.matchedUser.profile.ranking,
  };

  debugLog("retrieval.leetcode.success");
  return { type: "leetcode_stats", items: [payload], missing: false };
}

async function retrieve(intentReport) {
  debugLog("retrieval.dispatch.start", {
    retrieval: intentReport.execution.retrieval,
    subtype: intentReport.intentSubtype,
  });

  if (intentReport.execution.retrieval === "github_stats") {
    return fetchGithubStats();
  }
  if (intentReport.execution.retrieval === "leetcode_stats") {
    return fetchLeetcodeStats(intentReport.entities.leetcodeUsername);
  }
  if (intentReport.execution.retrieval === "full_search") {
    debugLog("retrieval.full_search.start", {
      queryLength: intentReport.semanticQuery?.length ?? 0,
      keywordCount: intentReport.keywords?.length ?? 0,
      limit: intentReport.constraints.limit,
    });
    return fullSearch({
      semanticQuery: intentReport.semanticQuery,
      keywords: intentReport.keywords,
      filters: intentReport.filters,
      limit: intentReport.constraints.limit,
    });
  }

  debugLog("retrieval.none");
  return { type: "none", items: [], missing: false };
}

module.exports = {
  retrieve,
};
