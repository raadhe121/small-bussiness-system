const { PrismaClient } = require("@prisma/client");

const baseUrl = process.env.DATABASE_URL || "";
const poolParams = "connection_limit=5&pool_timeout=30&connect_timeout=20&max_idle_time=60";
const url = baseUrl.includes("?")
  ? `${baseUrl}&${poolParams}`
  : `${baseUrl}?${poolParams}`;

const prisma = new PrismaClient({
  datasources: { db: { url } },
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

module.exports = prisma;
