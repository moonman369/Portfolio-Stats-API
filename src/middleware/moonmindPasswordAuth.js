"use strict";

function resolveConfiguredPassword() {
  const moonmindPassword =
    typeof process.env.MOONMIND_PASSWORD === "string"
      ? process.env.MOONMIND_PASSWORD.trim()
      : "";
  const refreshSecret =
    typeof process.env.REFRESH_SECRET === "string"
      ? process.env.REFRESH_SECRET.trim()
      : "";

  return moonmindPassword || refreshSecret || null;
}

function requireMoonMindPassword(req, res, next) {
  const configuredPassword = resolveConfiguredPassword();
  if (!configuredPassword) {
    return res.status(500).json({
      status: "error",
      message: "MoonMind password is not configured",
      error: { name: "ConfigurationError" },
    });
  }

  const headerPassword = Array.isArray(req.headers?.password)
    ? req.headers.password[0]
    : req.headers?.password;

  if (typeof headerPassword !== "string" || headerPassword !== configuredPassword) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized",
      error: { name: "UnauthorizedError" },
    });
  }

  return next();
}

module.exports = {
  requireMoonMindPassword,
  resolveConfiguredPassword,
};
