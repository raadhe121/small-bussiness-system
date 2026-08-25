const env = require("../config/env");
const { ApiError } = require("../utils/response");

/** 404 handler for unknown API routes. */
function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/** Centralized error middleware — always emits a consistent JSON shape. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors;

  // Prisma known errors -> friendly messages
  if (err.code === "P2002") {
    statusCode = 409;
    message = "A record with this value already exists";
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "";
    if (target) errors = [{ field: target, message: `${target} must be unique` }];
  } else if (err.code === "P2025") {
    statusCode = 404;
    message = "Record not found";
  } else if (err.code?.startsWith("P")) {
    statusCode = 400;
    message = "Database operation failed";
  }

  if (statusCode >= 500 && !env.isProd) {
    console.error("[error]", err);
  }
  if (statusCode >= 500 && env.isProd) {
    console.error("[error]", err.stack);
    message = "Internal server error";
    errors = undefined;
  }

  res.status(statusCode).json({ success: false, message, ...(errors ? { errors } : {}) });
}

module.exports = { notFound, errorHandler };
