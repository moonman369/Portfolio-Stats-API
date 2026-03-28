const express = require("express");
const router = express.Router();
const axios = require("axios");
const cache = require("memory-cache");

/**
 * @swagger
 * /api/v1/leetcode/{username}:
 *   get:
 *     summary: Fetch Leetcode stats for a user
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Leetcode username
 *     responses:
 *       200:
 *         description: Leetcode stats fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeetcodeResponse'
 *       500:
 *         description: Server error
 */
router.get("/:username", async (req, resp) => {
  const cachedResponse = cache.get(req.params.username);
  if (cachedResponse) {
    return resp.status(200).json(cachedResponse);
  }

  try {
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

    const [response, rankingResponse] = await Promise.all([
      axios.post(LEETCODE_API_ENDPOINT, {
        query: LEETCODE_GRAPHQL_QUERY,
        variables: { username: req.params.username },
        operationName: "userSessionProgress",
      }),
      axios.post(LEETCODE_API_ENDPOINT, {
        query: LEETCODE_GRAPHQL_QUERY_RANKING,
        variables: { username: req.params.username },
        operationName: "userPublicProfile",
      }),
    ]);

    const data = response.data.data;
    const obj = {
      status: "success",
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

    cache.put(req.params.username, obj, 1000 * 60 * 60); // Cache for 1 hour

    resp.status(200).json(obj);
  } catch (e) {
    console.error("leetcode.route.error", {
      username: req.params?.username,
      message: e?.message,
      stack: e?.stack,
    });
    resp.status(500).json({ status: "error", message: "Server Error" });
  }
});

module.exports = router;
