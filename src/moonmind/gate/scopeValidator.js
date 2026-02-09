function validateScope(intentReport) {
  if (intentReport.safety?.outOfScope) {
    return { allowed: false, reason: "out_of_scope" };
  }

  return { allowed: true };
}

module.exports = {
  validateScope,
};
