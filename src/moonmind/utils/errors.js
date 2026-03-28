class MoonMindError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "MoonMindError";
    this.details = details;
  }
}

module.exports = {
  MoonMindError,
};
