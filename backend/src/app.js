const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const apiRouter = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan("dev"));

  /**
   * Lightweight in-process rate limiter for auth endpoints.
   * In production this is replaced/extended at the Nginx layer
   * (limit_req zone) — see docs/DEPLOYMENT.md.
   */
  const authAttempts = new Map();
  const AUTH_WINDOW_MS = 15 * 60 * 1000;
  const AUTH_MAX = 30;
  function authRateLimit(req, res, next) {
    const key = req.ip || "unknown";
    const now = Date.now();
    const record = authAttempts.get(key) || { count: 0, start: now };
    if (now - record.start > AUTH_WINDOW_MS) {
      record.count = 0;
      record.start = now;
    }
    record.count += 1;
    authAttempts.set(key, record);
    if (record.count > AUTH_MAX) {
      return res.status(429).json({ success: false, message: "Too many attempts. Try again later." });
    }
    next();
  }
  app.use(["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password"], authRateLimit);

  app.use("/api", apiRouter());

  // Serve the built frontend in production (single-service deployment).
  if (env.isProd) {
    const path = require("path");
    const dist = path.join(__dirname, "../../frontend/dist");
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
