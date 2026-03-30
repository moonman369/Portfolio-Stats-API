const test = require("node:test");
const assert = require("node:assert/strict");

const {
  requireMoonMindPassword,
  resolveConfiguredPassword,
} = require("../src/middleware/moonmindPasswordAuth");

function createMockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function withEnv(overrides, fn) {
  const previousMoonmindPassword = process.env.MOONMIND_PASSWORD;
  const previousRefreshSecret = process.env.REFRESH_SECRET;

  try {
    if (Object.prototype.hasOwnProperty.call(overrides, "MOONMIND_PASSWORD")) {
      if (overrides.MOONMIND_PASSWORD === null) {
        delete process.env.MOONMIND_PASSWORD;
      } else {
        process.env.MOONMIND_PASSWORD = overrides.MOONMIND_PASSWORD;
      }
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "REFRESH_SECRET")) {
      if (overrides.REFRESH_SECRET === null) {
        delete process.env.REFRESH_SECRET;
      } else {
        process.env.REFRESH_SECRET = overrides.REFRESH_SECRET;
      }
    }

    fn();
  } finally {
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
  }
}

test("resolveConfiguredPassword prefers MOONMIND_PASSWORD over REFRESH_SECRET", () => {
  withEnv(
    {
      MOONMIND_PASSWORD: "moonmind-pass",
      REFRESH_SECRET: "refresh-secret",
    },
    () => {
      assert.equal(resolveConfiguredPassword(), "moonmind-pass");
    },
  );
});

test("requireMoonMindPassword returns 500 when no password is configured", () => {
  withEnv(
    {
      MOONMIND_PASSWORD: null,
      REFRESH_SECRET: null,
    },
    () => {
      const req = { headers: {} };
      const res = createMockRes();
      let calledNext = false;

      requireMoonMindPassword(req, res, () => {
        calledNext = true;
      });

      assert.equal(calledNext, false);
      assert.equal(res.statusCode, 500);
      assert.equal(res.body?.error?.name, "ConfigurationError");
    },
  );
});

test("requireMoonMindPassword returns 401 for missing or incorrect header", () => {
  withEnv(
    {
      MOONMIND_PASSWORD: null,
      REFRESH_SECRET: "Moonman#123",
    },
    () => {
      const req = { headers: { password: "wrong" } };
      const res = createMockRes();
      let calledNext = false;

      requireMoonMindPassword(req, res, () => {
        calledNext = true;
      });

      assert.equal(calledNext, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body?.error?.name, "UnauthorizedError");
    },
  );
});

test("requireMoonMindPassword calls next for valid password header", () => {
  withEnv(
    {
      MOONMIND_PASSWORD: null,
      REFRESH_SECRET: "Moonman#123",
    },
    () => {
      const req = { headers: { password: "Moonman#123" } };
      const res = createMockRes();
      let calledNext = false;

      requireMoonMindPassword(req, res, () => {
        calledNext = true;
      });

      assert.equal(calledNext, true);
      assert.equal(res.statusCode, null);
      assert.equal(res.body, null);
    },
  );
});
