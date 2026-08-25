const env = require("./config/env");
const { createApp } = require("./app");
const prisma = require("./config/prisma");

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`BusinessHub API running on port ${env.port} (${env.nodeEnv})`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
