const express = require("express");
const { runMoonMind } = require("../moonmind");
const { MoonMindError } = require("../moonmind/utils/errors");
const { debugLog, serializeError } = require("../moonmind/utils/debug");
const moonmindMemoryRoutes = require("../../routes/moonmindMemoryRoutes");
const {
  requireMoonMindPassword,
} = require("../middleware/moonmindPasswordAuth");

const router = express.Router();

router.use(moonmindMemoryRoutes);

/**
 * @swagger
 * /api/v1/moonmind/chat:
 *   post:
 *     summary: MoonMind intent-driven chat (alias of /api/v1/chat)
 *     description: >
 *       Identical behaviour to `POST /api/v1/chat`; both call the same pipeline.
 *     tags: [MoonMind Chat]
 *     security:
 *       - MoonMindPassword: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: MoonMind response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       400:
 *         description: Validation error (prompt missing or empty)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/chat", requireMoonMindPassword, async (req, res) => {
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
