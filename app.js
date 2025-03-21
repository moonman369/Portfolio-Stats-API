const express = require("express");
require("dotenv").config();
const fetch = require("cross-fetch");
const cors = require("cors");
const { Worker } = require("worker_threads");
const { connect, getStats } = require("./mongo");
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
  apis: ["./app.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Home Route
app.get("/", (req, res) => res.redirect("/api-docs"));

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
    const stats = [
      {
        _id: "65d4daea3c822f9149ce7684",
        stats: {
          repos: 106,
          commits: 1854,
          pulls: 45,
          stars: 238,
        },
      },
    ];

    resp.status(200).json(stats);
  } catch (e) {
    resp.status(500).json({ status: "error", message: "Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// const express = require("express");
// require("dotenv").config();
// const fetch = require("cross-fetch");
// const cors = require("cors");
// const { Worker } = require("worker_threads");
// const { connect, getStats } = require("./mongo");
// const { default: axios } = require("axios");
// // const {} = require("axios")
// const app = express();
// require("dotenv").config();

// const port = process.env.PORT || 8000;

// app.use(
//   cors({
//     origin: ["https://devfoliomoonman369.netlify.app", "https://moonman.in"],
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     credentials: true,
//     // origin: "*",
//   })
// );

// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "https://moonman.in");
//   res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
//   res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
//   next();
// });

// app.get("/", (req, res) => res.send("Express on Vercel"));

// app.get("/api/v1", (req, resp) => {
//   resp.status(404).json({
//     status: "error",
//     message: {
//       endpoints: {
//         "/api/v1/leetcode/{username}": "To fetch Leetcode stats",
//         "/api/v1/github/{username}": "To fetch GitHub stats",
//       },
//     },
//   });
// });

// app.get("/api/v1/leetcode/:username", async (req, resp) => {
//   try {
//     const LEETCODE_API_ENDPOINT = "https://leetcode.com/graphql/";
//     const visitor_ip = req.ip;
//     // const DAILY_CODING_CHALLENGE_QUERY =
//     // {
//     //     allQuestionsCount { difficulty count }
//     //         matchedUser(username: "${req.params.username}") {
//     //                     username
//     //                     contributions { points }
//     //                     profile { reputation ranking }
//     //                     submitStats  {
//     //                     acSubmissionNum { difficulty count submissions }
//     //         }
//     //     }
//     // }
//     // ;

//     const LEETCODE_GRAPHQL_QUERY =
//       "\n    query userSessionProgress($username: String!) {\n  allQuestionsCount {\n    difficulty\n    count\n  }\n  matchedUser(username: $username) {\n    submitStats {\n      acSubmissionNum {\n        difficulty\n        count\n        submissions\n      }\n      totalSubmissionNum {\n        difficulty\n        count\n        submissions\n      }\n    }\n  }\n}\n    ";

//     const LEETCODE_GRAPHQL_QUERY_RANKING =
//       "\n    query userPublicProfile($username: String!) {\n  matchedUser(username: $username) {\n    profile {\n      ranking\n}\n  }\n}\n    ";
//     // const init = {
//     //   method: "POST",
//     //   headers: { "Content-Type": "application/json" },
//     //   // body: JSON.stringify({
//     //   //   query: LEETCODE_GRAPHQL_QUERY,
//     //   //   variables: {
//     //   //     username: req.params.username,
//     //   //   },
//     //   //   operationName: "userSessionProgress",
//     //   // }),
//     //   body: {"query":"\n    query userSessionProgress($username: String!) {\n  allQuestionsCount {\n    difficulty\n    count\n  }\n  matchedUser(username: $username) {\n    submitStats {\n      acSubmissionNum {\n        difficulty\n        count\n        submissions\n      }\n      totalSubmissionNum {\n        difficulty\n        count\n        submissions\n      }\n    }\n  }\n}\n    ","variables":{"username":"moonman369"},"operationName":"userSessionProgress"},
//     // };

//     // const response = await fetch(LEETCODE_API_ENDPOINT, init);
//     // const data = await response.json();
//     // // const data = await response.toString();
//     // console.log(data);

//     const reponse = await axios.post(LEETCODE_API_ENDPOINT, {
//       query: LEETCODE_GRAPHQL_QUERY,
//       variables: { username: req.params.username },
//       operationName: "userSessionProgress",
//     });
//     const rankingReponse = await axios.post(LEETCODE_API_ENDPOINT, {
//       query: LEETCODE_GRAPHQL_QUERY_RANKING,
//       variables: { username: req.params.username },
//       operationName: "userPublicProfile",
//     });

//     console.log(await reponse.data);

//     const data = await reponse.data;
//     const rankingData = await rankingReponse.data;

//     const obj = {
//       status: "success",
//       totalSolved:
//         data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"][0][
//           "count"
//         ],
//       totalQuestions: data["data"]["allQuestionsCount"][0]["count"],
//       easySolved:
//         data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"][1][
//           "count"
//         ],
//       totalEasy: data["data"]["allQuestionsCount"][1]["count"],
//       mediumSolved:
//         data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"][2][
//           "count"
//         ],
//       totalMedium: data["data"]["allQuestionsCount"][2]["count"],
//       hardSolved:
//         data["data"]["matchedUser"]["submitStats"]["acSubmissionNum"][3][
//           "count"
//         ],
//       totalHard: data["data"]["allQuestionsCount"][3]["count"],
//       // contributionPoints:
//       //   data["data"]["matchedUser"]["contributions"]["points"],
//       // reputation: data["data"]["matchedUser"]["profile"]["reputation"],
//       ranking: rankingData["data"]["matchedUser"]["profile"]["ranking"],
//     };
//     if ((await reponse.status) === 200) {
//       resp.status(200).json(obj);
//     } else {
//       resp.status(reponse.status).json({ message: reponse.statusText });
//     }
//   } catch (e) {
//     console.log(e);
//     resp.status(500).json({ status: "error", message: "Server Error" });
//   }
// });

// app.get("/api/v1/refresh/:username", async (req, resp) => {
//   const refreshWorker = new Worker("./refresh_worker.js");
//   try {
//     await connect();
//     const options = {
//       headers: {
//         Accept: "application/vnd.github+json",
//         Authorization: `Bearer ${process.env.GITHUB_PAT}`,
//         "X-GitHub-Api-Version": "2022-11-28",
//       },
//     };
//     const response = await fetch(
//       `https//api.github.com/users/${req.params.username}`,
//       options
//     );

//     console.log(response.status);
//     if (response.status === 200) {
//       refreshWorker.postMessage([`${req.params.username}`, "test"]);
//       resp
//         .status(200)
//         .json({ message: "Refresh worker has been triggered successfully..." });
//     } else {
//       resp.status(response.status).json({ message: `${response.statusText}` });
//     }
//   } catch (error) {
//     console.log(error);
//     resp.status(500).json({ message: error });
//   }
// });

// app.get("/api/v1/github/:username", async (req, resp) => {
//   const visitor_ip = req.ip;
//   try {
//     const stats = await getStats();
//     console.log(stats);
//     resp.status(200).json(stats);
//   } catch (e) {
//     resp.status(500).json({ status: "error", message: "Server Error" });
//     console.log(e);
//   }
// });

// app.listen(port, () => {
//   console.log(`Server running on port: ${port}`);
// });
