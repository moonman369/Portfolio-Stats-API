const express = require("express");
require("dotenv").config();
const fetch = require("cross-fetch");
const cors = require("cors");
const { Worker } = require("worker_threads");
const { connect, getStats } = require("../mongo");
const { default: axios } = require("axios");
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();
const port = process.env.PORT || 8000;

// CORS configuration
app.use(
  cors({
    origin: ["https://devfoliomoonman369.netlify.app", "https://moonman.in"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Express API",
      version: "1.0.0",
      description: "API Documentation for Express.js",
    },
    servers: [{ url: "http://localhost:8000" }],
    components: {
      schemas: {
        LeetcodeResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "success" },
            totalSolved: { type: "integer", example: 219 },
            totalQuestions: { type: "integer", example: 3491 },
            easySolved: { type: "integer", example: 121 },
            totalEasy: { type: "integer", example: 867 },
            mediumSolved: { type: "integer", example: 94 },
            totalMedium: { type: "integer", example: 1813 },
            hardSolved: { type: "integer", example: 4 },
            totalHard: { type: "integer", example: 811 },
            ranking: { type: "integer", example: 512680 },
          },
        },
        GithubResponse: {
          type: "array",
          items: {
            type: "object",
            properties: {
              _id: { type: "string", example: "65d4daea3c822f9149ce7684" },
              stats: {
                type: "object",
                properties: {
                  repos: { type: "integer", example: 106 },
                  commits: { type: "integer", example: 1854 },
                  pulls: { type: "integer", example: 45 },
                  stars: { type: "integer", example: 238 },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ["./api/index.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Home Route
app.get("/", (req, res) => res.redirect("/api/docs"));

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
app.get("/api/v1/leetcode/:username", async (req, resp) => {
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

    const response = await axios.post(LEETCODE_API_ENDPOINT, {
      query: LEETCODE_GRAPHQL_QUERY,
      variables: { username: req.params.username },
      operationName: "userSessionProgress",
    });

    const data = response.data;
    const obj = {
      status: "success",
      totalSolved:
        data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"][0][
          "count"
        ],
      totalQuestions: data["data"]["allQuestionsCount"][0]["count"],
      easySolved:
        data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"][1][
          "count"
        ],
      totalEasy: data["data"]["allQuestionsCount"][1]["count"],
      mediumSolved:
        data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"][2][
          "count"
        ],
      totalMedium: data["data"]["allQuestionsCount"][2]["count"],
      hardSolved:
        data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"][3][
          "count"
        ],
      totalHard: data["data"]["allQuestionsCount"][3]["count"],
      ranking: 512680, // Mock ranking since it's not fetched in this query
    };

    resp.status(200).json(obj);
  } catch (e) {
    console.log(e);
    resp.status(500).json({ status: "error", message: "Server Error" });
  }
});

/**
 * @swagger
 * /api/v1/github/{username}:
 *   get:
 *     summary: Fetch GitHub stats for a user
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: GitHub username
 *     responses:
 *       200:
 *         description: GitHub stats fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GithubResponse'
 *       500:
 *         description: Server error
 */
app.get("/api/v1/github/:username", async (req, resp) => {
  try {
    const stats = await getStats();

    resp.status(200).json(stats);
  } catch (e) {
    resp.status(500).json({ status: "error", message: "Server Error" });
  }
});

/**
 * @swagger
 * /api/v1/refresh/{username}:
 *   get:
 *     summary: Refresh user stats
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Username to refresh stats
 *     responses:
 *       200:
 *         description: Refresh worker has been triggered successfully
 *       500:
 *         description: Server error
 */
app.get("/api/v1/refresh/", async (req, resp) => {
  const refreshWorker = new Worker("./refresh_worker.js");
  try {
    const username = process.env.REFRESH_PROFILE;
    if (!username) {
      return resp.status(500).json({
        message: "Username not found",
      });
    }
    await connect();
    const options = {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GITHUB_PAT}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };
    const response = await fetch(
      `https://api.github.com/users/${username}`,
      options
    );

    console.log(response.status);
    if (response.status === 200) {
      refreshWorker.postMessage([`${username}`, "test"]);
      resp
        .status(200)
        .json({ message: "Refresh worker has been triggered successfully..." });
    } else {
      resp.status(response.status).json({ message: `${response.statusText}` });
    }
  } catch (error) {
    console.log(error);
    resp.status(500).json({ message: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
