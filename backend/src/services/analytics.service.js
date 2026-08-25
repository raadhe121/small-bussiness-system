const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { add, round2, sub } = require("../utils/money");

/**
 * Dashboard & reports. All figures come from real database aggregates —
 * no static or fake numbers. Accepts a `scope` ({ businessId, branchId })
 * so owners/managers can view consolidated (branchId null) or per-branch data.
 */

const D = (v) => v?.toNumber() ?? 0;

// ---------- Dashboard ----------

async function getDashboard(scope) {
  const businessId = scope.businessId;
  const bf = scope.branchId ? { branchId: scope.branchId } : {};
  const branchSql = scope.branchId ? Prisma.sql` AND "branchId" = ${scope.branchId}` : Prisma.empty;
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);

  const [
    salesToday,
    purchasesToday,
    expensesToday,
    customerCount,
    supplierCount,
    productCount,
    lowStockProducts,
    receivables,
    payables,
    recentSales,
    recentPurchases,
    salesChartRaw,
    expenseChartRaw,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { businessId, ...bf, saleDate: { gte: todayStart, lt: tomorrowStart } },
      _sum: { grandTotal: true, dueAmount: true },
      _count: true,
    }),
    prisma.purchase.aggregate({
      where: { businessId, ...bf, purchaseDate: { gte: todayStart, lt: tomorrowStart } },
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { businessId, ...bf, expenseDate: { gte: todayStart, lt: tomorrowStart } },
      _sum: { amount: true },
    }),
    prisma.customer.count({ where: { businessId } }),
    prisma.supplier.count({ where: { businessId } }),
    prisma.product.count({ where: { businessId, status: "ACTIVE" } }),
    prisma.product.findMany({
      where: { businessId, status: "ACTIVE", currentStock: { lte: prisma.product.fields.minStock } },
      orderBy: { currentStock: "asc" },
      take: 8,
      select: { id: true, name: true, sku: true, unit: true, currentStock: true, minStock: true },
    }),
    prisma.customer.aggregate({ where: { businessId }, _sum: { outstanding: true } }),
    prisma.supplier.aggregate({ where: { businessId }, _sum: { outstanding: true } }),
    prisma.sale.findMany({
      where: { businessId, ...bf },
      orderBy: { saleDate: "desc" },
      take: 6,
      select: {
        id: true, invoiceNo: true, grandTotal: true, paidAmount: true, dueAmount: true,
        saleDate: true, paymentMethod: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.purchase.findMany({
      where: { businessId, ...bf },
      orderBy: { purchaseDate: "desc" },
      take: 6,
      select: {
        id: true, billNo: true, grandTotal: true, paidAmount: true, dueAmount: true,
        purchaseDate: true,
        supplier: { select: { name: true } },
      },
    }),
    prisma.$queryRaw`
      SELECT DATE("saleDate") as day,
             SUM("grandTotal") as totalSales,
             SUM("profit") as totalProfit,
             COUNT(*) as orders
      FROM "Sale"
      WHERE "businessId" = ${businessId} ${branchSql} AND "saleDate" >= ${new Date(todayStart.getTime() - 13 * 86400000)}
      GROUP BY DATE("saleDate")
      ORDER BY day ASC
    `,
    prisma.$queryRaw`
      SELECT DATE("expenseDate") as day, SUM("amount") as total
      FROM "Expense"
      WHERE "businessId" = ${businessId} ${branchSql} AND "expenseDate" >= ${new Date(todayStart.getTime() - 13 * 86400000)}
      GROUP BY DATE("expenseDate")
      ORDER BY day ASC
    `,
  ]);

  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  const salesByDay = Object.fromEntries(
    salesChartRaw.map((r) => [new Date(r.day).toISOString().slice(0, 10), r])
  );
  const expensesByDay = Object.fromEntries(
    expenseChartRaw.map((r) => [new Date(r.day).toISOString().slice(0, 10), D(r.total)])
  );

  const chart = days.map((day) => ({
    date: day,
    sales: round2(D(salesByDay[day]?.totalSales)),
    profit: round2(D(salesByDay[day]?.totalProfit)),
    expenses: round2(expensesByDay[day] ?? 0),
    orders: Number(salesByDay[day]?.orders ?? 0),
  }));

  const todayKey = todayStart.toISOString().slice(0, 10);
  return {
    today: {
      sales: round2(D(salesToday._sum.grandTotal)),
      salesCount: salesToday._count,
      purchases: round2(D(purchasesToday._sum.grandTotal)),
      purchasesCount: purchasesToday._count,
      expenses: round2(D(expensesToday._sum.amount)),
      profit: round2(D(salesByDay[todayKey]?.totalProfit)),
    },
    totals: {
      customers: customerCount,
      suppliers: supplierCount,
      products: productCount,
      receivables: round2(D(receivables._sum.outstanding)),
      payables: round2(D(payables._sum.outstanding)),
    },
    lowStockProducts: lowStockProducts.map((p) => ({
      ...p,
      currentStock: p.currentStock.toNumber(),
      minStock: p.minStock.toNumber(),
    })),
    inventoryAlerts: lowStockProducts.length,
    recentSales: recentSales.map((s) => ({ ...s, grandTotal: s.grandTotal.toNumber(), paidAmount: s.paidAmount.toNumber(), dueAmount: s.dueAmount.toNumber(), customerName: s.customer?.name || "Walk-in" })),
    recentPurchases: recentPurchases.map((p) => ({ ...p, grandTotal: p.grandTotal.toNumber(), paidAmount: p.paidAmount.toNumber(), dueAmount: p.dueAmount.toNumber(), supplierName: p.supplier?.name || "Unknown" })),
    chart,
  };
}

// ---------- Reports ----------

async function salesReport(scope, range) {
  const businessId = scope.businessId;
  const bf = scope.branchId ? { branchId: scope.branchId } : {};
  const branchSql = scope.branchId ? Prisma.sql` AND "branchId" = ${scope.branchId}` : Prisma.empty;
  const where = { businessId, ...bf, saleDate: range };
  const [summary, byDay, topProducts] = await Promise.all([
    prisma.sale.aggregate({ where, _sum: { grandTotal: true, paidAmount: true, dueAmount: true, totalTax: true, discount: true }, _count: true }),
    prisma.$queryRaw`
      SELECT DATE("saleDate") as day, SUM("grandTotal") as total, COUNT(*) as orders, SUM("profit") as profit
      FROM "Sale" WHERE "businessId" = ${businessId} ${branchSql}
        AND "saleDate" >= ${range.gte ?? new Date(0)}
        ${range.lt ? Prisma.sql`AND "saleDate" < ${range.lt}` : Prisma.empty}
      GROUP BY DATE("saleDate") ORDER BY day DESC LIMIT 120
    `,
    prisma.saleItem.groupBy({
      by: ["productName"],
      where: { sale: where },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 10,
    }),
  ]);
  return {
    summary: {
      totalSales: round2(D(summary._sum.grandTotal)),
      collected: round2(D(summary._sum.paidAmount)),
      outstanding: round2(D(summary._sum.dueAmount)),
      tax: round2(D(summary._sum.totalTax)),
      discounts: round2(D(summary._sum.discount)),
      orderCount: summary._count,
    },
    byDay: byDay.map((r) => ({ date: new Date(r.day).toISOString().slice(0, 10), total: round2(D(r.total)), orders: Number(r.orders), profit: round2(D(r.profit)) })).reverse(),
    topProducts: topProducts.map((t) => ({
      productName: t.productName,
      quantity: t._sum.quantity?.toNumber() ?? 0,
      revenue: round2(D(t._sum.lineTotal)),
    })),
  };
}

async function purchaseReport(scope, range) {
  const where = { businessId: scope.businessId, ...(scope.branchId ? { branchId: scope.branchId } : {}), purchaseDate: range };
  const summary = await prisma.purchase.aggregate({
    where,
    _sum: { grandTotal: true, paidAmount: true, dueAmount: true, totalTax: true },
    _count: true,
  });
  return {
    summary: {
      totalPurchases: round2(D(summary._sum.grandTotal)),
      paid: round2(D(summary._sum.paidAmount)),
      outstanding: round2(D(summary._sum.dueAmount)),
      tax: round2(D(summary._sum.totalTax)),
      billCount: summary._count,
    },
  };
}

async function profitReport(scope, range) {
  const bf = scope.branchId ? { branchId: scope.branchId } : {};
  const [sales, expenses, purchases] = await Promise.all([
    prisma.sale.aggregate({ where: { businessId: scope.businessId, ...bf, saleDate: range }, _sum: { subtotal: true, discount: true, costTotal: true, profit: true, grandTotal: true } }),
    prisma.expense.aggregate({ where: { businessId: scope.businessId, ...bf, expenseDate: range }, _sum: { amount: true } }),
    prisma.purchase.aggregate({ where: { businessId: scope.businessId, ...bf, purchaseDate: range }, _sum: { grandTotal: true } }),
  ]);
  const grossProfit = round2(D(sales._sum.profit));
  const totalExpenses = round2(D(expenses._sum.amount));
  return {
    revenue: round2(D(sales._sum.grandTotal)),
    netSales: round2(sub(D(sales._sum.subtotal), D(sales._sum.discount))),
    cogs: round2(D(sales._sum.costTotal)),
    grossProfit,
    operatingExpenses: totalExpenses,
    netProfit: sub(grossProfit, totalExpenses),
    purchases: round2(D(purchases._sum.grandTotal)),
  };
}

async function expenseReport(scope, range) {
  const bf = scope.branchId ? { branchId: scope.branchId } : {};
  const [byCategory, total] = await Promise.all([
    prisma.expense.groupBy({
      by: ["expenseCategoryId"],
      where: { businessId: scope.businessId, ...bf, expenseDate: range },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.aggregate({ where: { businessId: scope.businessId, ...bf, expenseDate: range }, _sum: { amount: true } }),
  ]);
  const categories = await prisma.expenseCategory.findMany({
    where: { businessId: scope.businessId, id: { in: byCategory.map((b) => b.expenseCategoryId) } },
    select: { id: true, name: true },
  });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  return {
    total: round2(D(total._sum.amount)),
    byCategory: byCategory.map((b) => ({
      category: catMap[b.expenseCategoryId] || "Unknown",
      amount: round2(D(b._sum.amount)),
      count: b._count,
    })).sort((a, b) => b.amount - a.amount),
  };
}

async function inventoryReport(scope) {
  const products = await prisma.product.findMany({
    where: { businessId: scope.businessId },
    include: { category: { select: { name: true } } },
    orderBy: { currentStock: "asc" },
  });
  let costValue = 0;
  const rows = products.map((p) => {
    const qty = p.currentStock.toNumber();
    const value = round2(qty * p.purchasePrice.toNumber());
    costValue = add(costValue, value);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      categoryName: p.category?.name || null,
      quantity: qty,
      minStock: p.minStock.toNumber(),
      purchasePrice: p.purchasePrice.toNumber(),
      stockValue: value,
      isLowStock: qty <= p.minStock.toNumber(),
      status: p.status,
    };
  });
  return { items: rows, stockValue: round2(costValue), productCount: products.length };
}

async function outstandingReport(scope) {
  const [customers, suppliers] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId: scope.businessId, outstanding: { gt: 0 } },
      orderBy: { outstanding: "desc" },
      select: { id: true, name: true, phone: true, outstanding: true, creditLimit: true },
    }),
    prisma.supplier.findMany({
      where: { businessId: scope.businessId, outstanding: { gt: 0 } },
      orderBy: { outstanding: "desc" },
      select: { id: true, name: true, phone: true, outstanding: true },
    }),
  ]);
  return {
    customers: customers.map((c) => ({ ...c, outstanding: c.outstanding.toNumber(), creditLimit: c.creditLimit.toNumber() })),
    suppliers: suppliers.map((s) => ({ ...s, outstanding: s.outstanding.toNumber() })),
    totals: {
      receivable: round2(customers.reduce((s, c) => add(s, c.outstanding.toNumber()), 0)),
      payable: round2(suppliers.reduce((s, x) => add(s, x.outstanding.toNumber()), 0)),
    },
  };
}

async function paymentReport(scope, range) {
  const bf = scope.branchId ? { branchId: scope.branchId } : {};
  const groupings = await prisma.payment.groupBy({
    by: ["method", "partyType"],
    where: { businessId: scope.businessId, ...bf, paymentDate: range },
    _sum: { amount: true },
    _count: true,
  });
  const totalAgg = await prisma.payment.aggregate({ where: { businessId: scope.businessId, ...bf, paymentDate: range }, _sum: { amount: true } });
  return {
    total: round2(D(totalAgg._sum.amount)),
    breakdown: groupings.map((g) => ({
      method: g.method,
      partyType: g.partyType,
      amount: round2(D(g._sum.amount)),
      count: g._count,
    })),
  };
}

// ---------- GST ----------

async function gstSummary(scope, range) {
  const businessId = scope.businessId;
  const branchSql = scope.branchId ? Prisma.sql` AND s."branchId" = ${scope.branchId}` : Prisma.empty;
  const [salesTax, purchaseTax, rateWise] = await Promise.all([
    prisma.sale.aggregate({
      where: { businessId, ...(scope.branchId ? { branchId: scope.branchId } : {}), saleDate: range },
      _sum: { cgst: true, sgst: true, igst: true, totalTax: true, subtotal: true, discount: true },
    }),
    prisma.purchase.aggregate({
      where: { businessId, ...(scope.branchId ? { branchId: scope.branchId } : {}), purchaseDate: range },
      _sum: { totalTax: true },
    }),
    prisma.$queryRaw`
      SELECT si."taxRate" AS taxRate,
             SUM(si."quantity" * si."rate" - si."discount") AS taxableAmount,
             SUM(si."taxAmount") AS taxAmount
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."businessId" = ${businessId} ${branchSql}
        AND s."saleDate" >= ${range.gte ?? new Date(0)}
        ${range.lt ? Prisma.sql`AND s."saleDate" < ${range.lt}` : Prisma.empty}
      GROUP BY si."taxRate"
      ORDER BY si."taxRate" ASC
    `,
  ]);

  return {
    outputTax: {
      cgst: round2(D(salesTax._sum.cgst)),
      sgst: round2(D(salesTax._sum.sgst)),
      igst: round2(D(salesTax._sum.igst)),
      total: round2(D(salesTax._sum.totalTax)),
    },
    inputTaxCredit: {
      total: round2(D(purchaseTax._sum.totalTax)),
    },
    netPayable: sub(round2(D(salesTax._sum.totalTax)), round2(D(purchaseTax._sum.totalTax))),
    taxableSales: round2(sub(D(salesTax._sum.subtotal), D(salesTax._sum.discount))),
    rateWise: rateWise.map((r) => ({
      taxRate: Number(r.taxRate),
      taxableAmount: round2(D(r.taxableAmount)),
      taxAmount: round2(D(r.taxAmount)),
    })),
  };
}

module.exports = {
  getDashboard,
  salesReport,
  purchaseReport,
  profitReport,
  expenseReport,
  inventoryReport,
  outstandingReport,
  paymentReport,
  gstSummary,
};
