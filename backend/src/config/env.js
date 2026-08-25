require("dotenv").config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT || "5000", 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  renderUrl: process.env.RENDER_EXTERNAL_URL || "",
};

if (!env.databaseUrl) throw new Error("DATABASE_URL is not set");
if (!env.jwtSecret || env.jwtSecret.length < 16) {
  throw new Error("JWT_SECRET must be set and at least 16 characters long");
}

module.exports = env;
