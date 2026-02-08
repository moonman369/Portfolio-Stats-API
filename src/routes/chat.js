const express = require("express");
const { runMoonMind } = require("../moonmind");
const { MoonMindError } = require("../moonmind/utils/errors");

const router = express.Router();

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: MoonMind intent-driven chat
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *               sessionId:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: MoonMind response
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post("/", async (req, res) => {
  try {
    const result = await runMoonMind({
      prompt: req.body?.prompt,
      sessionId: req.body?.sessionId,
      metadata: req.body?.metadata,
    });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof MoonMindError) {
      return res.status(400).json({
        status: "error",
        message: error.message,
        details: error.details,
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Server Error",
    });
  }
});

module.exports = router;
