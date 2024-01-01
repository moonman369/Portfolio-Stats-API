require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const { cookie } = require("request");
const URI = process.env.MONGO_URI;
const DB_NAME = "portfolio-stats-api";
const COLLECTION_NAME = "gitStatsArchive";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function connect() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    return client;
  }
}

const setStats = async (repos, commits, pulls, stars) => {
  const client = await connect();
  const database = client.db(DB_NAME);
  const collection = database.collection(COLLECTION_NAME);

  await collection.drop();

  await collection.insertOne({
    stats: {
      repos: repos,
      commits: commits,
      pulls: pulls,
      stars: stars,
    },
  });
  await client.close();
};

const getStats = async () => {
  const client = await connect();
  const database = client.db(DB_NAME);
  const collection = database.collection(COLLECTION_NAME);
  const cursor = await collection.find();
  const stats = cursor.toArray();
  return stats;
};

module.exports = {
  connect,
  setStats,
  getStats,
};
