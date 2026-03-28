require("dotenv").config();
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const { MongoClient, ServerApiVersion } = require("mongodb");
const { debugLog, serializeError } = require("./src/moonmind/utils/debug");

const URI = process.env.MONGO_URI;
const DB_NAME = "portfolio-stats-api";
const COLLECTION_NAME = "gitStatsArchive";
const STATS_ID = "github_stats";

let cachedClient = null;
let cachedDb = null;
let cachedNonStrictClient = null;
let cachedNonStrictDb = null;

async function connectToDatabase(options = {}) {
  const { apiStrict = true } = options;
  debugLog("mongo.connect.start", { apiStrict });

  if (apiStrict && cachedClient && cachedDb) {
    debugLog("mongo.connect.cache_hit", { apiStrict: true });
    return { client: cachedClient, db: cachedDb };
  }

  if (!apiStrict && cachedNonStrictClient && cachedNonStrictDb) {
    debugLog("mongo.connect.cache_hit", { apiStrict: false });
    return { client: cachedNonStrictClient, db: cachedNonStrictDb };
  }

  const client = new MongoClient(URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: apiStrict,
      deprecationErrors: true,
    },
  });

  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    debugLog("mongo.connect.ping_success", { apiStrict });

    const db = client.db(DB_NAME);

    if (apiStrict) {
      cachedClient = client;
      cachedDb = db;
    } else {
      cachedNonStrictClient = client;
      cachedNonStrictDb = db;
    }

    debugLog("mongo.connect.success", { apiStrict, dbName: DB_NAME });
    return { client, db };
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    debugLog("mongo.connect.error", {
      apiStrict,
      error: serializeError(error),
    });
    throw error;
  }
}

const setStats = async (repos, commits, pulls, stars) => {
  debugLog("mongo.setStats.start");
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
  debugLog("mongo.setStats.success");
};

const getStats = async () => {
  debugLog("mongo.getStats.start");
  const { db } = await connectToDatabase();
  const collection = db.collection(COLLECTION_NAME);
  const stats = await collection.findOne({ _id: STATS_ID });
  debugLog("mongo.getStats.success", {
    found: Boolean(stats),
  });
  return stats;
};

module.exports = {
  connectToDatabase,
  setStats,
  getStats,
};
