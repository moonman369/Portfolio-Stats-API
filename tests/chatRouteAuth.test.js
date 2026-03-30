const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const chatRouter = require("../src/routes/chat");

function setEnvForTest() {
  const previousMoonmindPassword = process.env.MOONMIND_PASSWORD;
  const previousRefreshSecret = process.env.REFRESH_SECRET;

  process.env.MOONMIND_PASSWORD = "";
  process.env.REFRESH_SECRET = "moonmind-test-password";

  return () => {
    if (typeof previousMoonmindPassword === "undefined") {
      delete process.env.MOONMIND_PASSWORD;
    } else {
      process.env.MOONMIND_PASSWORD = previousMoonmindPassword;
    }

    if (typeof previousRefreshSecret === "undefined") {
      delete process.env.REFRESH_SECRET;
    } else {
      process.env.REFRESH_SECRET = previousRefreshSecret;
    }
  };
}

test("POST /api/v1/chat requires password header", async () => {
  const restoreEnv = setEnvForTest();
  const app = express();
  app.use(express.json());
  app.use("/api/v1/chat", chatRouter);

  const server = app.listen(0);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: "hello" }),
    });

    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body?.error?.name, "UnauthorizedError");
  } finally {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
    restoreEnv();
  }
});
