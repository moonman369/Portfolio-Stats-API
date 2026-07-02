const express = require("express");
const router = express.Router();
const { getLeetcodeStats } = require("../moonmind/statsService");

/**
 * @swagger
 * /api/v1/leetcode/{username}:
 *   get:
 *     summary: Fetch Leetcode stats for a user
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Leetcode username
 *     responses:
 *       200:
 *         description: Leetcode stats fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeetcodeResponse'
 *       500:
 *         description: Server error
 */
router.get("/:username", async (req, resp) => {
  try {
    const stats = await getLeetcodeStats(req.params.username);
    resp.status(200).json(stats);
  } catch (e) {
    console.error("leetcode.route.error", {
      username: req.params?.username,
      message: e?.message,
      stack: e?.stack,
    });
    resp.status(500).json({ status: "error", message: "Server Error" });
  }
});

module.exports = router;
