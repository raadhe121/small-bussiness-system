const env = require("./config/env");
const { createApp } = require("./app");
const prisma = require("./config/prisma");

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`DukaanSetu API running on port ${env.port} (${env.nodeEnv})`);
});

// Keep-alive: ping our own /api/health every 14 minutes so the process
// (and its pooled DB connection) never goes idle/cold.
const KEEPALIVE_MS = 14 * 60 * 1000;
function startKeepAlive() {
  const ping = async () => {
    try {
      await fetch(`http://127.0.0.1:${env.port}/api/health`, { method: "GET" });
      console.log(`[keepalive] health ping ok at ${new Date().toISOString()}`);
    } catch (err) {
      console.error("[keepalive] health ping failed:", err.message);
    }
  };
  setInterval(ping, KEEPALIVE_MS).unref();
  console.log(`[keepalive] self health-ping scheduled every ${KEEPALIVE_MS / 60000} min`);
}
startKeepAlive();

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
