const express = require("express");
require("dotenv").config();
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { connectToDatabase } = require("../mongo");

const leetcodeRouter = require("../src/routes/leetcode");
const githubRouter = require("../src/routes/github");
const refreshRouter = require("../src/routes/refresh");
const swaggerDocs = require("../src/swagger");

const app = express();
const port = process.env.PORT || 8000;

// CORS configuration
app.use(
  cors({
    origin: ["https://devfoliomoonman369.netlify.app", "https://moonman.in"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

app.listen(port, async () => {
  await connectToDatabase();
  console.log(`Server running on http://localhost:${port}`);
});
