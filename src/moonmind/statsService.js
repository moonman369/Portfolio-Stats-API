const axios = require("axios");
const cache = require("memory-cache");
const { getStats } = require("../../mongo");

const LEETCODE_API_ENDPOINT = "https://leetcode.com/graphql/";
const LEETCODE_GRAPHQL_QUERY = `query userSessionProgress($username: String!) {
  allQuestionsCount { difficulty count }
  matchedUser(username: $username) {
    submitStats {
      acSubmissionNum { difficulty count submissions }
    }
  }
}`;
const LEETCODE_GRAPHQL_QUERY_RANKING = `query userPublicProfile($username: String!) {
  matchedUser(username: $username) {
      profile {
        ranking
      }
    }
  }`;
const LEETCODE_DEFAULT_USERNAME =
  process.env.LEETCODE_USERNAME || "moonman369";
const LEETCODE_CACHE_TTL_MS = 1000 * 60 * 60;

async function getGithubStats() {
  return getStats();
}

async function getLeetcodeStats(username = LEETCODE_DEFAULT_USERNAME) {
  const cacheKey = `leetcode:${username}`;
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  const [response, rankingResponse] = await Promise.all([
    axios.post(LEETCODE_API_ENDPOINT, {
      query: LEETCODE_GRAPHQL_QUERY,
      variables: { username },
      operationName: "userSessionProgress",
    }),
    axios.post(LEETCODE_API_ENDPOINT, {
      query: LEETCODE_GRAPHQL_QUERY_RANKING,
      variables: { username },
      operationName: "userPublicProfile",
    }),
  ]);

  const data = response.data.data;
  const stats = {
    status: "success",
    username,
    totalSolved: data.matchedUser.submitStats.acSubmissionNum[0].count,
    totalQuestions: data.allQuestionsCount[0].count,
    easySolved: data.matchedUser.submitStats.acSubmissionNum[1].count,
    totalEasy: data.allQuestionsCount[1].count,
    mediumSolved: data.matchedUser.submitStats.acSubmissionNum[2].count,
    totalMedium: data.allQuestionsCount[2].count,
    hardSolved: data.matchedUser.submitStats.acSubmissionNum[3].count,
    totalHard: data.allQuestionsCount[3].count,
    ranking: rankingResponse.data.data.matchedUser.profile.ranking,
  };

  cache.put(cacheKey, stats, LEETCODE_CACHE_TTL_MS);
  return stats;
}

module.exports = {
  getGithubStats,
  getLeetcodeStats,
};
