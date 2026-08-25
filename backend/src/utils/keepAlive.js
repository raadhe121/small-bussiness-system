const env = require("../config/env");

const INTERVAL_MS = 14 * 60 * 1000;

function startKeepAlive() {
  if (!env.renderUrl) return null;

  const ping = async () => {
    try {
      const res = await globalThis.fetch(`${env.renderUrl}/api/health`);
      console.log(`[keep-alive] ping ${res.status} at ${new Date().toISOString()}`);
    } catch (err) {
      console.error(`[keep-alive] ping failed: ${err.message}`);
    }
  };

  const timer = setInterval(ping, INTERVAL_MS);
  timer.unref();
  console.log(`[keep-alive] pinging ${env.renderUrl}/api/health every 14 minutes`);
  return timer;
}

module.exports = { startKeepAlive };
