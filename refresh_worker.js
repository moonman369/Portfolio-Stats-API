require("dotenv").config();
const { parentPort } = require("worker_threads");
const { setStats } = require("./mongo");

parentPort.on("message", async (username) => {
  const start = Date.now();
  try {
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
          `https://api.github.com/users/${username}/repos?per_page=100`,
          options
        )
      ).json();
      console.log(
        "============================================= REPOS =============================================\n"
      );
      console.log(repos);
      reposCount += repos?.length;
    } while (repos.length >= 100);

    for (let repo of repos) {
      starsCount += repo.stargazers_count;

      const res = await (
        await fetch(
          `https://api.github.com/repos/${username}/${repo.name}/pulls?state=all`,
          options
        )
      ).json();
      console.log(
        "\n\n\n============================================= PULLS =============================================\n"
      );
      console.log(res);
      pullsCount += res?.length;

      const comms = await (
        await fetch(
          `https://api.github.com/repos/${username}/${repo.name}/commits?per_page=300`,
          options
        )
      ).json();
      console.log(
        "\n\n\n============================================= COMMITS =============================================\n"
      );
      console.log(comms);
      for (let comm of comms) {
        if (comm?.author?.login === `${username}`) {
          commitsCount += 1;
        }
      }
    }

    // await updateStatsItem(reposCount, commitsCount, pullsCount, starsCount);
    await setStats(reposCount, commitsCount, pullsCount, starsCount);
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
        "message": "Server error",
        "elapsed": ${Date.now() - start}
      }
    `);
  }
});
