const express = require("express");
const router = express.Router();
const { Worker } = require("worker_threads");
const axios = require("axios");
const { refreshStats } = require("../../refresh_worker");
require("dotenv").config();

/**
 * @swagger
 * /api/v1/refresh:
 *   get:
 *     summary: Refresh user stats
 *     responses:
 *       200:
 *         description: Refresh worker has been triggered successfully
 *       500:
 *         description: Server error
 */
router.get("/", async (req, resp) => {
  if (req.query.secret !== process.env.REFRESH_SECRET) {
    // console.log(req.query.secret, process.env.REFRESH_SECRET);
    return resp.status(401).json({
      message: "You are not authorized to perform this action",
    });
  }
  const refreshWorker = new Worker("./refresh_worker.js");
  try {
    const username = process.env.REFRESH_PROFILE;
    if (!username) {
      return resp.status(500).json({
        message: "Username not found",
      });
    }
    const options = {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${process.env.GITHUB_PAT}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };
    const response = await axios.get(
      `https://api.github.com/users/${username}`,
      options,
    );

    if (response.status === 200) {
      if (req.query.useWorker === "true") {
        refreshWorker.postMessage([`${username}`, "test"]);
        resp.status(200).json({
          message: "Refresh worker has been triggered successfully...",
        });
      } else {
        const res = await refreshStats([`${username}`, "test"]);
        resp.status(res.status === "success" ? 200 : 500).json(res);
      }
    } else {
      resp.status(response.status).json({ message: `${response.statusText}` });
    }
  } catch (error) {
    console.log(error);
    resp.status(500).json({ message: error.message });
  }
});

module.exports = router;
