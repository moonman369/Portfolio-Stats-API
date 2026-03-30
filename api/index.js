const express = require("express");
require("dotenv").config();
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { connectToDatabase } = require("../mongo");

const leetcodeRouter = require("../src/routes/leetcode");
const githubRouter = require("../src/routes/github");
const refreshRouter = require("../src/routes/refresh");
const chatRouter = require("../src/routes/chat");
const moonmindRouter = require("../src/routes/moonmind");
const moonmindMemoryRoutes = require("../routes/moonmindMemoryRoutes");
const swaggerDocs = require("../src/swagger");

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json({ limit: "1mb" }));

// CORS configuration
app.use(
  cors({
    origin: [
      "https://devfoliomoonman369.netlify.app",
      "https://moonman.in",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "password"],
    credentials: true,
  }),
);

// Swagger
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Home Route
app.get("/", (req, res) => res.redirect("/api/docs"));

// API Routes
app.use("/api/v1/leetcode", leetcodeRouter);
app.use("/api/v1/github", githubRouter);
app.use("/api/v1/refresh", refreshRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/moonmind", moonmindRouter);
app.use("/api/v1", moonmindMemoryRoutes);

app.listen(port, async () => {
  await connectToDatabase();
  console.log(`Server running on http://localhost:${port}`);
});
