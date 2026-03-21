const express = require("express");
const { runMoonMind } = require("../moonmind");
const { MoonMindError } = require("../moonmind/utils/errors");
const { debugLog, serializeError } = require("../moonmind/utils/debug");
const moonmindMemoryRoutes = require("../../routes/moonmindMemoryRoutes");

const router = express.Router();

router.use(moonmindMemoryRoutes);

router.post("/chat", async (req, res) => {
  debugLog("moonmind.route.request", {
    hasPrompt: typeof req.body?.prompt === "string",
    sessionId: req.body?.sessionId ?? null,
  });

  try {
    const result = await runMoonMind({
      prompt: req.body?.prompt,
      sessionId: req.body?.sessionId,
      metadata: req.body?.metadata,
    });

    return res.status(200).json(result);
  } catch (error) {
    const serializedError = serializeError(error);
    debugLog("moonmind.route.error", serializedError);

    if (error instanceof MoonMindError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        details: error.details,
        error: serializedError,
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Server Error",
      details: error?.details ?? null,
      error: serializedError,
    });
  }
});

module.exports = router;
