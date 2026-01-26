require("dotenv").config();
const { parentPort } = require("worker_threads");
const { setStats } = require("./mongo");
const { default: axios } = require("axios");

const GITHUB_GRAPHQL_API_ENDPOINT = "https://api.github.com/graphql";

const GITHUB_GRAPHQL_QUERY = `
  query ($username: String!, $afterCursor: String) {
    user(login: $username) {
      repositories(
        first: 100
        after: $afterCursor
        ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        isFork: false
        orderBy: {field: CREATED_AT, direction: DESC}
      ) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          name
          visibility
          stargazers {
            totalCount
          }
          pullRequests(states: [OPEN, CLOSED, MERGED]) {
            totalCount
          }
          defaultBranchRef {
            target {
              ... on Commit {
                history {
                  totalCount
                }
              }
            }
          }
        }
      }
    }
  }
`;

// parentPort.on("message", async (params) => {
//   await refreshStats(params);
//   parentPort.close();
// });

const refreshStats = async (params) => {
  const start = Date.now();
  const username = params[0];
  try {
    const options = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GITHUB_PAT}`,
      },
    };
    console.log("Starting refresh job...");

    let allRepos = [];
    let hasNextPage = true;
    let afterCursor = null;

    console.log(`hasNextPage: ${hasNextPage}`);
    while (hasNextPage) {
      const response = await axios.post(
        GITHUB_GRAPHQL_API_ENDPOINT,
        {
          query: GITHUB_GRAPHQL_QUERY,
          variables: { username, afterCursor },
        },
        options,
      );

      const userData = response.data.data.user;
      allRepos = allRepos.concat(userData.repositories.nodes);
      hasNextPage = userData.repositories.pageInfo.hasNextPage;
      afterCursor = userData.repositories.pageInfo.endCursor;
    }

    const totalRepos = allRepos.length;
    let totalCommits = 0;
    let totalStars = 0;
    let totalPulls = 0;

    for (const repo of allRepos) {
      totalStars += repo.stargazers.totalCount;
      totalPulls += repo.pullRequests.totalCount;
      if (repo.defaultBranchRef) {
        totalCommits += repo.defaultBranchRef.target.history.totalCount;
      }
    }

    console.log({
      totalRepos,
      totalCommits,
      totalStars,
      totalPulls,
    });

    await setStats(totalRepos, totalCommits, totalPulls, totalStars);
    console.log(
      `\n\n\n\n\n\n    END OF REFRESH JOB\n    {\n        "status": "success",\n        "message": "Refresh success",\n        "elapsed": ${Date.now() - start}\n      }\n    `,
    );
    return {
      status: "success",
      message: "Refresh success",
      elapsed: Date.now() - start,
      totalRepos,
      totalCommits,
      totalStars,
      totalPulls,
    };
  } catch (error) {
    console.log(error);
    console.log(
      `\n\n\n\n\n\n    END OF REFRESH JOB\n    {\n        "status": "error",\n        "message": ${error},\n        "elapsed": ${Date.now() - start}\n      }\n    `,
    );
    return {
      status: "error",
      message: error,
      elapsed: Date.now() - start,
    };
  }
};

module.exports = { refreshStats };
