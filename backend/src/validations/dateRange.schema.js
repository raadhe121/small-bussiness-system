const { z } = require("zod");

/** Date range preset -> resolved [from, to) in UTC. */
const PRESETS = ["today", "yesterday", "this_week", "this_month", "custom"];

const startOfDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

function resolveDateRange({ from, to }) {
  const now = new Date();
  let startDate;
  if (from) startDate = new Date(from);
  const endDate = to ? new Date(to) : null;

  return { startDate, endDate };
}

const dateRangeSchema = z
  .object({
    preset: z.enum(["today", "yesterday", "this_week", "this_month"]).optional(),
    from: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    to: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  })
  .refine((v) => v.preset || v.from || v.to, { message: "Provide a preset or from/to dates" });

/**
 * Resolves validated query into concrete UTC datetime bounds.
 * Bare YYYY-MM-DD `to` is inclusive (extended to end of day).
 */
function getRange(validated = {}) {
  const now = new Date();
  const todayStart = startOfDay(now);
  if (validated.preset === "today") return { gte: todayStart, lt: addDays(todayStart, 1) };
  if (validated.preset === "yesterday") return { gte: addDays(todayStart, -1), lt: todayStart };
  if (validated.preset === "this_week") {
    const dow = (now.getUTCDay() + 6) % 7; // Monday = 0
    const weekStart = addDays(todayStart, -dow);
    return { gte: weekStart, lt: addDays(weekStart, 7) };
  }
  if (validated.preset === "this_month") {
    return { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
  }
  const gte = validated.from ? new Date(validated.from) : undefined;
  let lt;
  if (validated.to) {
    const t = new Date(validated.to);
    // If user passed a plain date (00:00), include the whole day.
    lt = /^\d{4}-\d{2}-\d{2}$/.test(validated.to) ? addDays(startOfDay(t), 1) : t;
  }
  return { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) };
}

module.exports = { dateRangeSchema, getRange, PRESETS, resolveDateRange };
