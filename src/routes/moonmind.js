const express = require("express");
const { debugLog } = require("../moonmind/utils/debug");
const moonmindMemoryRoutes = require("../../routes/moonmindMemoryRoutes");

const router = express.Router();

router.use(moonmindMemoryRoutes);

router.post("/chat", (req, res) => {
  debugLog("moonmind.route.request.received", {
    hasPrompt: typeof req.body?.prompt === "string",
  });

  try {
    const prompt = req.body?.prompt;

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      const validationError = {
        name: "ValidationError",
        message: "prompt must be a non-empty string",
      };
      debugLog("moonmind.route.validation.error", validationError);
      return res.status(400).json({
        status: "error",
        message: validationError.message,
        details: { field: "prompt" },
        error: validationError,
      });
    }

    debugLog("moonmind.route.success");
    return res.status(200).json({
      status: "ok",
      message: "MoonMind endpoint scaffolded",
    });
  } catch (error) {
    debugLog("moonmind.route.error", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({
      status: "error",
      message: "Server Error",
      details: error?.details ?? null,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
    });
  }
});

module.exports = router;
