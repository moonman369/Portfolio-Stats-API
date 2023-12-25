const express = require("express");
const fetch = require("cross-fetch");
const cors = require("cors");
const { createStatsItem, getStats, updateStatsItem } = require("./cyclic-db");
// const {} = require("axios")
const app = express();
require("dotenv").config();

const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: "https://devfoliomoonman369.netlify.app",
  })
);

app.get("/", (req, resp) => {
  resp.status(404).json({
    status: "error",
    message:
      "please enter your username (eg: https://leetcode-api.cyclic.app/moonman369)",
  });
});

app.get("/leetcode/:username", async (req, resp) => {
  try {
    const LEETCODE_API_ENDPOINT = "https://leetcode.com/graphql";
    const DAILY_CODING_CHALLENGE_QUERY = `
                {    
                    allQuestionsCount { difficulty count }
                        matchedUser(username: "${req.params.username}") {
                                    username
                                    contributions { points }
                                    profile { reputation ranking }
                                    submitStats  {
                                    acSubmissionNum { difficulty count submissions } 
                        }
                    }
                }
                `;

    const init = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: DAILY_CODING_CHALLENGE_QUERY }),
    };

    const response = await fetch(LEETCODE_API_ENDPOINT, init);
    const data = await response.json();

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
      ranking: data["data"]["matchedUser"]["profile"]["ranking"],
      contributionPoints:
        data["data"]["matchedUser"]["contributions"]["points"],
      reputation: data["data"]["matchedUser"]["profile"]["reputation"],
    };
    resp.status(200).json(obj);
  } catch (e) {
    resp.status(404).json({ status: "error", message: "Username Not Found" });
  }
});

app.get("/github/:username", async (req, resp) => {
  try {
    const options = {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization:
          "Bearer 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",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };
    const data = {
      repos: 0,
      commits: 0,
      stars: 0,
    };
    let repos = [];
    do {
      repos = await (
        await fetch(
          `https://api.github.com/users/${req.params.username}/repos?per_page=100`,
          options
        )
      ).json();

      data.repos += repos.length;
    } while (repos.length >= 100);
    await createStatsItem();
    await updateStatsItem(repos.length, 0, 0, 0);
    const stats = await getStats();
    console.log(stats);
    resp.status(200).json(data);
  } catch (e) {
    resp.status(404).json({ status: "error", message: "Username Not Found" });
    console.log(e);
  }
});

app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});
