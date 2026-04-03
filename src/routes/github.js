const express = require("express");
const router = express.Router();
const { getGithubStats } = require("../moonmind/statsService");

/**
 * @swagger
 * /api/v1/github:
 *   get:
 *     summary: Fetch GitHub stats
 *     responses:
 *       200:
 *         description: GitHub stats fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GithubResponse'
 *       500:
 *         description: Server error
 */
router.get("/", async (req, resp) => {
  try {
    const stats = await getGithubStats();
    resp.status(200).json(stats);
  } catch (e) {
    console.error("github.route.error", {
      message: e?.message,
      stack: e?.stack,
    });
    resp.status(500).json({ status: "error", message: "Server Error" });
  }
});

module.exports = router;
