const express = require("express");

const router = express.Router();

router.post("/chat", (req, res) => {
  const prompt = req.body?.prompt;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({
      status: "error",
      message: "prompt must be a non-empty string",
    });
  }

  return res.status(200).json({
    status: "ok",
    message: "MoonMind endpoint scaffolded",
  });
});

module.exports = router;
