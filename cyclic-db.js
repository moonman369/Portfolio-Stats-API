require("dotenv").config();

const configDB = () => {
  const CyclicDB = require("@cyclic.sh/dynamodb");
  const db = CyclicDB(process.env.CYCLIC_DB);
  return db;
};

const createStatsItem = async () => {
  const db = configDB();
  let coll = db.collection("collection0");

  let stats = await coll.set("stats", {
    repos: 0,
    commits: 0,
    pulls: 0,
    stars: 0,
  });
};

const getStats = async () => {
  const db = configDB();
  let coll = db.collection("collection0");
  let stats = coll.get("stats");
  console.log(stats);
  return stats;
};

const updateStatsItem = async (repos, commits, pulls, stars) => {
  const db = configDB();
  let coll = db.collection("collection0");

  let stats = await coll.set("stats", {
    repos: repos,
    commits: commits,
    pulls: pulls,
    stars: stars,
  });
};

module.exports = {
  configDB,
  createStatsItem,
  getStats,
  updateStatsItem,
};
