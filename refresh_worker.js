require("dotenv").config();
const { parentPort } = require("worker_threads");
const { setStats } = require("./mongo");
const { default: axios } = require("axios");

parentPort.on("message", async (params) => {
  const start = Date.now();
  const username = params[0];
  try {
    const options = {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GITHUB_PAT}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };
    console.log("Starting refresh job...");

    let totalRepos = 0;
    let totalCommits = 0;
    let totalStars = 0;
    let totalPulls = 0;

    // Fetch commits, stars, and pull requests from each repo
    for (let i = 1; i <= 2; i++) {
      // Get repo count
      const reposResponse = await axios.get(
        `https://api.github.com/users/${username}/repos?per_page=100&page=${i}`,
        options
      );
      totalRepos += reposResponse.data.length;

      for (const repo of reposResponse.data) {
        const repoName = repo.name;

        // Get commit count (approximate, depends on API limits)
        const commitsResponse = await axios.get(
          `https://api.github.com/repos/${username}/${repoName}/commits?per_page=100&page=${i}`,
          options
        );
        totalCommits += commitsResponse.data.length;

        // Get star count
        totalStars += repo.stargazers_count;

        // Get pull request count
        const pullsResponse = await axios.get(
          `https://api.github.com/repos/${username}/${repoName}/pulls?state=all&per_page=1`,
          options
        );
        totalPulls += pullsResponse.data.length;
      }
    }

    console.log({
      totalRepos,
      totalCommits,
      totalStars,
      totalPulls,
    });

    // await updateStatsItem(reposCount, commitsCount, pullsCount, starsCount);
    await setStats(totalRepos, totalCommits, totalPulls, totalStars);
    console.log(`\n\n\n\n\n
    END OF REFRESH JOB
    {
        "status": "success",
        "message": "Refresh success",
        "elapsed": ${Date.now() - start}
      }
    `);
  } catch (error) {
    console.log(error);
    console.log(`\n\n\n\n\n
    END OF REFRESH JOB 
    {
        "status": "error",
        "message": ${error},
        "elapsed": ${Date.now() - start}
      }
    `);
  }
});
