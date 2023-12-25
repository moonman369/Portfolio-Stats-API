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
    resp.status(500).json({ status: "error", message: "Server Error" });
  }
});

app.get("/refresh/:username", async (req, resp) => {
  try {
    const start = Date.now();
    const options = {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GITHUB_PAT}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };
    let [reposCount, commitsCount, pullsCount, starsCount] = [0, 0, 0, 0];
    let repos = [];
    do {
      repos = await (
        await fetch(
          `https://api.github.com/users/${req.params.username}/repos?per_page=100`,
          options
        )
      ).json();
      console.log(repos);
      reposCount += repos?.length;
    } while (repos.length >= 100);

    for (let repo of repos) {
      starsCount += repo.stargazers_count;

      const res = await (
        await fetch(
          `https://api.github.com/repos/${req.params.username}/${repo.name}/pulls?state=all`,
          options
        )
      ).json();
      pullsCount += res?.length;

      const comms = await (
        await fetch(
          `https://api.github.com/repos/${req.params.username}/${repo.name}/commits?per_page=300`,
          options
        )
      ).json();
      for (let comm of comms) {
        if (comm?.author?.login === `${req.params.username}`) {
          commitsCount += 1;
        }
      }
    }

    await updateStatsItem(reposCount, commitsCount, pullsCount, starsCount);
    resp.status(200).json({
      status: "success",
      message: "Refresh success",
      elapsed: `${Date.now() - start}`,
    });
  } catch (error) {
    console.log(error);
    resp.status(500).json({
      status: "error",
      message: "Server Error",
    });
  }
});

app.get("/github/:username", async (req, resp) => {
  try {
    const stats = await getStats();
    console.log(stats);
    resp.status(200).json(stats);
  } catch (e) {
    resp.status(500).json({ status: "error", message: "Server Error" });
    console.log(e);
  }
});

app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});
