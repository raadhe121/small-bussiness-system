const { ApiError } = require("./response");

/** Wraps async route handlers so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Throws a 404 ApiError if the value is null/undefined. */
const assertFound = (value, message = "Resource not found") => {
  if (!value) throw new ApiError(404, message);
  return value;
};

module.exports = { asyncHandler, assertFound };
