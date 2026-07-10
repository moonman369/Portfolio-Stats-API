const express = require("express");
require("dotenv").config();
// Fail fast with a clear error when the vector/RAG env contract is incomplete.
require("../config/vectorConfig").validateRequiredConfig();
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

// Behind the Nginx/Certbot reverse proxy: trust the first proxy hop so that
// req.ip / req.protocol reflect the real client instead of the proxy.
app.set("trust proxy", 1);

app.use(express.json({ limit: "1mb" }));

// CORS configuration
app.use(
  cors({
    origin: [
      "https://devfoliomoonman369.netlify.app",
      "https://moonman.in",
      "https://moonman.in/",
      "https://new.moonman.in",
      "https://new.moonman.in/",
      "http://localhost:3000",
      "http://localhost:5173",
      "https://portfolio-2-sigma-bice.vercel.app/",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "password"],
    credentials: true,
  }),
);

// Health check (dependency-free; used by Docker HEALTHCHECK and uptime probes)
app.get("/health", (req, res) =>
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
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

const server = app.listen(port, async () => {
  await connectToDatabase();
  console.log(`Server running on http://localhost:${port}`);
});

// Graceful shutdown: Docker sends SIGTERM (then SIGKILL after ~10s) on stop /
// compose restart. Drain in-flight requests instead of dropping them.
const shutdown = (signal) => {
  console.log(`${signal} received — shutting down gracefully...`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("Forced shutdown: connections did not close in time.");
    process.exit(1);
  }, 10000).unref();
};

["SIGTERM", "SIGINT"].forEach((signal) =>
  process.on(signal, () => shutdown(signal)),
);
