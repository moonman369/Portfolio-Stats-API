const { runMoonMindPipeline } = require("./pipeline");

async function runMoonMind({ prompt, sessionId, metadata = {} }) {
  return runMoonMindPipeline({
    query: prompt,
    sessionId,
    metadata,
  });
}

module.exports = {
  runMoonMind,
  runMoonMindPipeline,
};
