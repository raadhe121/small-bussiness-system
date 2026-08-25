const prisma = require("../config/prisma");
const { round2, localDayKey } = require("../utils/money");

/**
 * Report engine. Every report accepts from/to Date boundaries and returns
 * aggregates + per-day series computed with real DB queries.
 */

function dayBounds(dateLike) {
  const d = new Date(dateLike);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Groups daily totals using raw SQL (safe, parameterized). */
async function dailyTotals(table, dateColumn, sumColumns, businessId, from, to) {
  const sums = sumColumns.map((c) => `COALESCE(SUM("${c}"),0) AS "${c}"`).join(", ");
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DATE("${dateColumn}") AS day, ${sums}, COUNT(*) AS count
     FROM "${table}"
     WHERE "businessId" = $1 AND "${dateColumn}" >= $2 AND "${dateColumn}" < $3
     GROUP BY DATE("${dateColumn}")
     ORDER BY day ASC`,
    businessId, from, to
  );
  return rows.map((r) => ({
    date: r.day instanceof Date ? localDayKey(r.day) : String(r.day),
    count: Number(r.count),
    ...Object.fromEntries(sumColumns.map((c) => [c, Number(r[c])])),
  }));
}

async function salesReport(businessId, from, to) {
  const [series, agg, topProducts] = await Promise.all([
    dailyTotals("Sale", "saleDate", ["grandTotal", "paidAmount", "dueAmount", "totalTax", "profit"], businessId, from, to),
    prisma.sale.aggregate({
      where: { businessId, saleDate: { gte: from, lt: to } },
      _count: true,
      _sum: { grandTotal: true, paidAmount: true, dueAmount: true, profit: true, discount: true },
    }),
    prisma.saleItem.groupBy({
      by: ["productName"],
      where: { sale: { businessId, saleDate: { gte: from, lt: to } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 10,
    }),
  ]);
  return {
    series,
    totals: {
      invoices: agg._count,
      totalSales: agg._sum.grandTotal || 0,
      collected: agg._sum.paidAmount || 0,
      outstanding: agg._sum.dueAmount || 0,
      profit: agg._sum.profit || 0,
      discounts: agg._sum.discount || 0,
    },
    topProducts: topProducts.map((p) => ({
      name: p.productName,
      quantity: Number(p._sum.quantity || 0),
      revenue: p._sum.lineTotal || 0,
    })),
  };
}

async function purchasesReport(businessId, from, to) {
  const series = await dailyTotals("Purchase", "purchaseDate", ["grandTotal", "paidAmount", "dueAmount"], businessId, from, to);
  const agg = await prisma.purchase.aggregate({
    where: { businessId, purchaseDate: { gte: from, lt: to } },
    _count: true,
    _sum: { grandTotal: true, paidAmount: true, dueAmount: true },
  });
  return {
    series,
    totals: {
      bills: agg._count,
      totalPurchases: agg._sum.grandTotal || 0,
      paid: agg._sum.paidAmount || 0,
      outstanding: agg._sum.dueAmount || 0,
    },
  };
}

// Profit = gross margin (sales taxable - cost) - expenses for the period.
async function profitReport(businessId, from, to) {
  const [sales, expensesSeries, expenseAgg] = await Promise.all([
    dailyTotals("Sale", "saleDate", ["subtotal", "costTotal", "profit", "grandTotal"], businessId, from, to),
    dailyTotals("Expense", "expenseDate", ["amount"], businessId, from, to),
    prisma.expense.aggregate({
      where: { businessId, expenseDate: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
  ]);
  const expenseByDay = new Map(expensesSeries.map((e) => [e.date, e.amount]));
  const series = sales.map((s) => ({
    date: s.date,
    revenue: s.subtotal,
    cost: s.costTotal,
    grossProfit: s.profit,
    expenses: expenseByDay.get(s.date) || 0,
    netProfit: round2(s.profit - (expenseByDay.get(s.date) || 0)),
  }));
  return {
    series,
    totals: {
      revenue: series.reduce((a, s) => a + s.revenue, 0),
      cost: series.reduce((a, s) => a + s.cost, 0),
      grossProfit: series.reduce((a, s) => a + s.grossProfit, 0),
      expenses: expenseAgg._sum.amount || 0,
    },
  };
}

async function expenseReport(businessId, from, to) {
  const byCategory = await prisma.expense.groupBy({
    by: ["expenseCategoryId"],
    where: { businessId, expenseDate: { gte: from, lt: to } },
    _sum: { amount: true },
    _count: true,
  });
  const cats = await prisma.expenseCategory.findMany({ where: { businessId }, select: { id: true, name: true } });
  const nameById = new Map(cats.map((c) => [c.id, c.name]));
  const series = await dailyTotals("Expense", "expenseDate", ["amount"], businessId, from, to);
  const total = byCategory.reduce((a, c) => a + Number(c._sum.amount || 0), 0);
  return {
    series,
    byCategory: byCategory
      .map((c) => ({ category: nameById.get(c.expenseCategoryId) || "Unknown", amount: c._sum.amount || 0, count: c._count }))
      .sort((a, b) => b.amount - a.amount),
    totals: { total, count: byCategory.reduce((a, c) => a + c._count, 0) },
  };
}

async function inventoryReport(businessId) {
  const products = await prisma.product.findMany({
    where: { businessId, status: "ACTIVE" },
    select: {
      name: true, sku: true, unit: true, currentStock: true, minStock: true,
      purchasePrice: true, sellingPrice: true,
      category: { select: { name: true } },
    },
    orderBy: { currentStock: "asc" },
    take: 500,
  });
  let stockCost = 0, stockRetail = 0;
  for (const p of products) {
    stockCost += Number(p.currentStock) * Number(p.purchasePrice);
    stockRetail += Number(p.currentStock) * Number(p.sellingPrice);
  }
  return {
    products,
    totals: {
      skus: products.length,
      lowStock: products.filter((p) => Number(p.currentStock) <= Number(p.minStock)).length,
      stockCost: round2(stockCost),
      stockRetail: round2(stockRetail),
      potentialMargin: round2(stockRetail - stockCost),
    },
  };
}

async function receivables(businessId) {
  const rows = await prisma.customer.findMany({
    where: { businessId, outstanding: { gt: 0 } },
    select: { id: true, name: true, phone: true, outstanding: true, creditLimit: true },
    orderBy: { outstanding: "desc" },
    take: 200,
  });
  return { items: rows, total: round2(rows.reduce((a, r) => a + Number(r.outstanding), 0)) };
}

async function payables(businessId) {
  const rows = await prisma.supplier.findMany({
    where: { businessId, outstanding: { gt: 0 } },
    select: { id: true, name: true, phone: true, outstanding: true },
    orderBy: { outstanding: "desc" },
    take: 200,
  });
  return { items: rows, total: round2(rows.reduce((a, r) => a + Number(r.outstanding), 0)) };
}

async function paymentsReport(businessId, from, to) {
  const received = await dailyTotals("Payment", "paymentDate", [], businessId, from, to);
  // Split directions via aggregate queries.
  const inAgg = await prisma.payment.aggregate({
    where: { businessId, direction: "RECEIVED", paymentDate: { gte: from, lt: to } },
    _sum: { amount: true }, _count: true,
  });
  const outAgg = await prisma.payment.aggregate({
    where: { businessId, direction: "PAID", paymentDate: { gte: from, lt: to } },
    _sum: { amount: true }, _count: true,
  });
  const byMethod = await prisma.payment.groupBy({
    by: ["method", "direction"],
    where: { businessId, paymentDate: { gte: from, lt: to } },
    _sum: { amount: true },
  });
  return {
    series: received,
    totals: {
      received: inAgg._sum.amount || 0,
      receivedCount: inAgg._count,
      paid: outAgg._sum.amount || 0,
      paidCount: outAgg._count,
    },
    byMethod: byMethod.map((m) => ({ method: m.method, direction: m.direction, amount: m._sum.amount || 0 })),
  };
}

module.exports = {
  salesReport,
  purchasesReport,
  profitReport,
  expenseReport,
  inventoryReport,
  receivables,
  payables,
  paymentsReport,
};
