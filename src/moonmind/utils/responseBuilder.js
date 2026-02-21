function buildSuccessResponse({ mode, intentReport, data }) {
  return {
    status: "success",
    mode,
    intentReport,
    data,
  };
}

function buildRedirectResponse({ intentReport, message }) {
  return {
    status: "redirect",
    intentReport,
    message,
  };
}

module.exports = {
  buildSuccessResponse,
  buildRedirectResponse,
};
