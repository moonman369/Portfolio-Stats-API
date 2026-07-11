const express = require("express");
const { runMoonMind } = require("../moonmind");
const { MoonMindError } = require("../moonmind/utils/errors");
const { debugLog, serializeError } = require("../moonmind/utils/debug");
const {
  requireMoonMindPassword,
} = require("../middleware/moonmindPasswordAuth");

const router = express.Router();

/**
 * @swagger
 * /api/v1/chat:
 *   post:
 *     summary: MoonMind intent-driven chat
 *     description: >
 *       Embeds the prompt with Gemini, retrieves through the semantic, keyword
 *       and metadata arms fused with RRF, then generates a grounded summary.
 *       GitHub and LeetCode stats questions are routed separately.
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
router.post("/", requireMoonMindPassword, async (req, res) => {
  debugLog("chat.route.request.received", {
    hasPrompt: typeof req.body?.prompt === "string",
    sessionId: req.body?.sessionId ?? null,
    metadataKeys: req.body?.metadata ? Object.keys(req.body.metadata) : [],
  });

  try {
    debugLog("chat.route.runMoonMind.start");
    const result = await runMoonMind({
      prompt: req.body?.prompt,
      sessionId: req.body?.sessionId,
      metadata: req.body?.metadata,
    });
    debugLog("chat.route.runMoonMind.success", {
      status: result?.status,
      mode: result?.mode,
    });
    res.status(200).json(result);
  } catch (error) {
    const serializedError = serializeError(error);
    console.error("chat.route.runMoonMind.error", {
      message: error?.message,
      stack: error?.stack,
    });
    debugLog("chat.route.runMoonMind.error", serializedError);

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
