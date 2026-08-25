const prisma = require("../config/prisma");

/**
 * Interactive (async) transaction with a generous timeout.
 *
 * Prisma's default interactive-transaction timeout is 5s. Our mutations run
 * many sequential queries (row locks, stock recompute, multi-row writes), and
 * when the server talks to a remote/pooled database each query adds latency, so
 * the default can be exceeded and every mutation fails with P2028 ("Transaction
 * not found"). We raise the limit here in one place.
 */
async function transaction(fn) {
  return prisma.$transaction(fn, { maxWait: 20000, timeout: 60000 });
}

module.exports = { prisma, transaction };
