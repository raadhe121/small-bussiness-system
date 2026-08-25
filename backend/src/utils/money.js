const { Prisma } = require("@prisma/client");

/**
 * Money helpers. All financial values are stored as Prisma Decimal.
 * Arithmetic happens on integers (paise) to avoid float drift, then
 * results are converted back to Decimal-safe strings for Prisma.
 */

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** Formats a Date as a server-local YYYY-MM-DD key (matches MySQL DATE()). */
const localDayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const add = (...values) =>
  values.reduce((sum, v) => sum + Math.round(Number(v) * 100), 0) / 100;

const sub = (a, b) => (Math.round(Number(a) * 100) - Math.round(Number(b) * 100)) / 100;

const mul = (a, b) => (Math.round(Number(a) * 100) * Math.round(Number(b) * 100)) / 10000;

const D = (value) => (value === null || value === undefined ? null : new Prisma.Decimal(String(value)));

/** Tax-inclusive line math: returns { taxable, taxAmount, lineTotal } */
function computeLine({ quantity, rate, discount, taxRate }) {
  const gross = mul(quantity, rate);
  const taxable = Math.max(0, sub(gross, discount));
  const taxAmount = round2(mul(taxable, Number(taxRate) / 100));
  const lineTotal = add(taxable, taxAmount);
  return {
    gross: round2(gross),
    taxable,
    taxAmount,
    lineTotal,
    quantity: Number(quantity),
  };
}

module.exports = { round2, add, sub, mul, D, dec: Prisma.Decimal, computeLine, localDayKey };
