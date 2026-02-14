function validateScope(intentReport) {
  if (!intentReport.is_in_scope) {
    return {
      allowed: false,
      reason: intentReport.out_of_scope_reason || "out_of_scope",
      message:
        intentReport.polite_redirect_message ||
        "I can only help with portfolio, software, science, or technology topics.",
    };
  }

  return { allowed: true, reason: null, message: null };
}

module.exports = {
  validateScope,
};
