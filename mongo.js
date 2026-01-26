require("dotenv").config();
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const { MongoClient, ServerApiVersion } = require("mongodb");

const URI = process.env.MONGO_URI;
const DB_NAME = "portfolio-stats-api";
const COLLECTION_NAME = "gitStatsArchive";
const STATS_ID = "github_stats";

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    console.log("Found Cached client");
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    const db = client.db(DB_NAME);

    cachedClient = client;
    cachedDb = db;

    return { client, db };
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    throw error;
  }
}

const setStats = async (repos, commits, pulls, stars) => {
  const { db } = await connectToDatabase();
  const collection = db.collection(COLLECTION_NAME);

  await collection.updateOne(
    { _id: STATS_ID },
    {
      $set: {
        stats: {
          repos,
          commits,
          pulls,
          stars,
        },
      },
    },
    { upsert: true },
  );
};

const getStats = async () => {
  const { db } = await connectToDatabase();
  const collection = db.collection(COLLECTION_NAME);
  const stats = await collection.findOne({ _id: STATS_ID });
  return stats;
};

module.exports = {
  connectToDatabase,
  setStats,
  getStats,
};
