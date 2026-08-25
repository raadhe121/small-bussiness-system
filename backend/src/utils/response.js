/**
 * Centralized API response helpers and application error class.
 * Every endpoint responds with { success, message, data } or
 * { success, message, errors }.
 */

class ApiError extends Error {
  constructor(statusCode, message, errors = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
  }
}

const ok = (res, data = null, message = "Success", statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const created = (res, data = null, message = "Created successfully") =>
  ok(res, data, message, 201);

const fail = (res, message, statusCode = 400, errors = undefined) =>
  res.status(statusCode).json({ success: false, message, ...(errors ? { errors } : {}) });

module.exports = { ApiError, ok, created, fail };
