const axios = require("axios");
const { getStats } = require("../../../mongo");
const { fullSearch } = require("./fullSearch");

async function fetchGithubStats() {
  const stats = await getStats();
  if (!stats?.stats) {
    return { type: "github_stats", items: [], missing: true };
  }
  return { type: "github_stats", items: [stats], missing: false };
}

async function fetchLeetcodeStats(username) {
  if (!username) {
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

  const [response, rankingResponse] = await Promise.all([
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

  const data = response.data?.data;
  const ranking = rankingResponse.data?.data;

  if (!data?.matchedUser || !ranking?.matchedUser) {
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

  return { type: "leetcode_stats", items: [payload], missing: false };
}

async function retrieve(intentReport) {
  if (intentReport.execution.retrieval === "github_stats") {
    return fetchGithubStats();
  }
  if (intentReport.execution.retrieval === "leetcode_stats") {
    return fetchLeetcodeStats(intentReport.entities.leetcodeUsername);
  }
  if (intentReport.execution.retrieval === "full_search") {
    return fullSearch({
      semanticQuery: intentReport.semanticQuery,
      keywords: intentReport.keywords,
      filters: intentReport.filters,
      limit: intentReport.constraints.limit,
    });
  }

  return { type: "none", items: [], missing: false };
}

module.exports = {
  retrieve,
};
