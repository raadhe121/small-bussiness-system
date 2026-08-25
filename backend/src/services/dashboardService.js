const prisma = require("../config/prisma");
const { round2, localDayKey } = require("../utils/money");

/** Dashboard aggregates — every number comes from live DB queries. */

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const startOfTomorrow = () => {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
};

async function getDashboard(businessId) {
  const todayStart = startOfToday();
  const tomorrow = startOfTomorrow();
  const chartFrom = new Date(todayStart);
  chartFrom.setDate(chartFrom.getDate() - 13);

  const [
    salesToday, purchasesToday, expensesToday, profitToday,
    customersCount, suppliersCount, productsCount, lowStockCount,
    receivableAgg, payableAgg,
    recentSales, recentPurchases,
    salesSeries, purchaseSeries, expenseSeries,
    inventoryValue,
  ] = await Promise.all([
    prisma.sale.aggregate({ where: { businessId, saleDate: { gte: todayStart, lt: tomorrow } }, _sum: { grandTotal: true }, _count: true }),
    prisma.purchase.aggregate({ where: { businessId, purchaseDate: { gte: todayStart, lt: tomorrow } }, _sum: { grandTotal: true }, _count: true }),
    prisma.expense.aggregate({ where: { businessId, expenseDate: { gte: todayStart, lt: tomorrow } }, _sum: { amount: true } }),
    prisma.sale.aggregate({ where: { businessId, saleDate: { gte: todayStart, lt: tomorrow } }, _sum: { profit: true } }),
    prisma.customer.count({ where: { businessId, isActive: true } }),
    prisma.supplier.count({ where: { businessId, isActive: true } }),
    prisma.product.count({ where: { businessId, status: "ACTIVE" } }),
    prisma.product.count({ where: { businessId, status: "ACTIVE", currentStock: { lte: prisma.product.fields.minStock } } }),
    prisma.customer.aggregate({ where: { businessId, outstanding: { gt: 0 } }, _sum: { outstanding: true }, _count: true }),
    prisma.supplier.aggregate({ where: { businessId, outstanding: { gt: 0 } }, _sum: { outstanding: true }, _count: true }),
    prisma.sale.findMany({
      where: { businessId },
      orderBy: { saleDate: "desc" },
      take: 5,
      include: { customer: { select: { name: true } } },
    }),
    prisma.purchase.findMany({
      where: { businessId },
      orderBy: { purchaseDate: "desc" },
      take: 5,
      include: { supplier: { select: { name: true } } },
    }),
    dailySum("Sale", "saleDate", ["grandTotal", "profit"], businessId, chartFrom, tomorrow),
    dailySum("Purchase", "purchaseDate", ["grandTotal"], businessId, chartFrom, tomorrow),
    dailySum("Expense", "expenseDate", ["amount"], businessId, chartFrom, tomorrow),
    stockValuation(businessId),
  ]);

  // Merge the three series into a single day-indexed array of 14 days.
  const days = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(chartFrom);
    d.setDate(d.getDate() + i);
    days.push({ date: localDayKey(d), sales: 0, purchases: 0, expenses: 0, profit: 0 });
  }
  const byKey = new Map(days.map((d) => [d.date, d]));
  for (const r of salesSeries) Object.assign(byKey.get(r.day) || {}, { sales: r.grandTotal, profit: r.profit });
  for (const r of purchaseSeries) if (byKey.has(r.day)) byKey.get(r.day).purchases = r.grandTotal;
  for (const r of expenseSeries) if (byKey.has(r.day)) byKey.get(r.day).expenses = r.amount;

  const lowStockProducts = await prisma.product.findMany({
    where: { businessId, status: "ACTIVE", currentStock: { lte: prisma.product.fields.minStock } },
    select: { id: true, name: true, sku: true, unit: true, currentStock: true, minStock: true },
    orderBy: { currentStock: "asc" },
    take: 8,
  });

  return {
    today: {
      sales: round2(salesToday._sum.grandTotal || 0),
      salesCount: salesToday._count,
      purchases: round2(purchasesToday._sum.grandTotal || 0),
      expenses: round2(expensesToday._sum.amount || 0),
      profit: round2(profitToday._sum.profit || 0),
    },
    counts: {
      customers: customersCount,
      suppliers: suppliersCount,
      products: productsCount,
      lowStock: lowStockCount,
    },
    outstanding: {
      receivable: round2(receivableAgg._sum.outstanding || 0),
      receivableCustomers: receivableAgg._count,
      payable: round2(payableAgg._sum.outstanding || 0),
      payableSuppliers: payableAgg._count,
    },
    inventory: inventoryValue,
    charts: { days },
    recentSales,
    recentPurchases,
    lowStockProducts,
  };
}

async function dailySum(table, dateColumn, columns, businessId, from, to) {
  const sums = columns.map((c) => `COALESCE(SUM("${c}"),0) AS "${c}"`).join(", ");
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DATE("${dateColumn}") AS day, ${sums}
     FROM "${table}"
     WHERE "businessId" = $1 AND "${dateColumn}" >= $2 AND "${dateColumn}" < $3
     GROUP BY DATE("${dateColumn}")`,
    businessId, from, to
  );
  // Format using server-local calendar date to match MySQL's DATE().
  return rows.map((r) => ({
    day:
      r.day instanceof Date
        ? `${r.day.getFullYear()}-${String(r.day.getMonth() + 1).padStart(2, "0")}-${String(r.day.getDate()).padStart(2, "0")}`
        : String(r.day).slice(0, 10),
    ...Object.fromEntries(columns.map((c) => [c, Number(r[c])])),
  }));
}

async function stockValuation(businessId) {
  const rows = await prisma.product.findMany({
    where: { businessId, status: "ACTIVE", currentStock: { gt: 0 } },
    select: { currentStock: true, purchasePrice: true },
  });
  let value = 0;
  for (const r of rows) value += Number(r.currentStock) * Number(r.purchasePrice);
  return { value: round2(value), skusWithStock: rows.length };
}

module.exports = { getDashboard };
