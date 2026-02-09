const DEBUG_NAMESPACE = "moonmind";

function isDebugEnabled() {
  return process.env.MOONMIND_DEBUG !== "false";
}

function debugLog(step, payload) {
  if (!isDebugEnabled()) {
    return;
  }

  const prefix = `[${DEBUG_NAMESPACE}][debug] ${step}`;
  if (typeof payload === "undefined") {
    console.log(prefix);
    return;
  }

  console.log(prefix, payload);
}

function serializeError(error) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return { message: error };
  }

  const details =
    error.details && typeof error.details === "object" ? error.details : error.details;

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code ?? error?.details?.code,
    details,
  };
}

module.exports = {
  debugLog,
  serializeError,
  isDebugEnabled,
};
