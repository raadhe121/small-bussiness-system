const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { round2, add, sub, D } = require("../utils/money");

/**
 * Inventory service (branch-aware).
 *
 * Stock is tracked PER BRANCH via BranchStock. Product.currentStock stays the
 * business-wide TOTAL (sum of every BranchStock row) so consolidated views and
 * legacy endpoints keep working. Every mutation runs in a Prisma transaction
 * and writes an InventoryTransaction (with branchId) for full audit history.
 */

const Decimal = (v) => D(v);

async function lockProduct(tx, businessId, productId) {
  const rows = await tx.$queryRaw`
    SELECT id FROM "Product" WHERE id = ${productId} AND "businessId" = ${businessId} FOR UPDATE
  `;
  if (!rows.length) throw new ApiError(404, "Product not found");
}

async function getBranchStock(tx, branchId, productId) {
  const bs = await tx.branchStock.findUnique({
    where: { branchId_productId: { branchId, productId } },
  });
  return bs ? Number(bs.quantity) : 0;
}

/** Recomputes Product.currentStock + Inventory.quantity as the branch total. */
async function recomputeTotal(tx, businessId, productId) {
  const agg = await tx.branchStock.aggregate({
    where: { businessId, productId },
    _sum: { quantity: true },
  });
  const total = agg._sum.quantity ? Number(agg._sum.quantity) : 0;
  await tx.product.update({ where: { id: productId }, data: { currentStock: Decimal(total) } });
  await tx.inventory.upsert({
    where: { productId },
    create: { businessId, productId, quantity: total },
    update: { quantity: total },
  });
  return total;
}

/**
 * Applies a stock change to one branch and keeps the business total in sync.
 * `branchBalanceAfter` is the new quantity for THAT branch.
 */
async function applyStockChange(tx, { businessId, branchId, productId, type, quantity, branchBalanceAfter, referenceType, referenceId, note, userId }) {
  if (!branchId) throw new ApiError(400, "A branch is required for stock changes");
  await tx.branchStock.upsert({
    where: { branchId_productId: { branchId, productId } },
    create: { businessId, branchId, productId, quantity: branchBalanceAfter },
    update: { quantity: branchBalanceAfter },
  });
  const total = await recomputeTotal(tx, businessId, productId);
  await tx.inventoryTransaction.create({
    data: {
      businessId,
      productId,
      branchId,
      type,
      quantity: Decimal(quantity),
      balanceAfter: Decimal(total),
      referenceType: referenceType || null,
      referenceId: referenceId || null,
      note: note || null,
      createdBy: userId,
    },
  });
  return total;
}

/** Reads branch stock for many products at once (for sale/purchase loops). */
async function loadBranchStockMap(tx, branchId, productIds) {
  const rows = await tx.branchStock.findMany({
    where: { branchId, productId: { in: productIds } },
  });
  return new Map(rows.map((r) => [r.productId, Number(r.quantity)]));
}

// ---------- Queries ----------

async function listInventory(scope, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId: scope.businessId,
    ...(query.search ? {
      product: { OR: [{ name: { contains: query.search } }, { sku: { contains: query.search } }] },
    } : {}),
    ...(query.lowStock ? { product: { currentStock: { lte: prisma.product.fields.minStock }, status: "ACTIVE" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: "desc" },
      include: {
        product: {
          select: {
            id: true, name: true, sku: true, unit: true, minStock: true, currentStock: true,
            purchasePrice: true, sellingPrice: true, status: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.inventory.count({ where }),
  ]);

  // Per-branch quantities for the visible products.
  const productIds = items.map((inv) => inv.product.id);
  const branchStocks = await prisma.branchStock.findMany({
    where: { businessId: scope.businessId, productId: { in: productIds } },
    include: { branch: { select: { id: true, name: true } } },
  });

  const rows = items.map((inv) => {
    const branches = branchStocks
      .filter((b) => b.productId === inv.product.id)
      .map((b) => ({ branchId: b.branchId, branchName: b.branch.name, quantity: Number(b.quantity) }));
    const qty = scope.branchId
      ? (branches.find((b) => b.branchId === scope.branchId)?.quantity ?? 0)
      : inv.product.currentStock.toNumber();
    return {
      id: inv.id,
      productId: inv.product.id,
      productName: inv.product.name,
      sku: inv.product.sku,
      unit: inv.product.unit,
      categoryName: inv.product.category?.name || null,
      quantity: qty,
      minStock: inv.product.minStock.toNumber(),
      purchasePrice: inv.product.purchasePrice.toNumber(),
      sellingPrice: inv.product.sellingPrice.toNumber(),
      stockValue: round2(qty * inv.product.purchasePrice.toNumber()),
      isLowStock: qty <= inv.product.minStock.toNumber(),
      status: inv.product.status,
      branchStocks: branches,
      updatedAt: inv.updatedAt,
    };
  });

  return { items: rows, meta: buildMeta({ page, limit }, total) };
}

async function stockValuation(scope) {
  if (scope.branchId) {
    const rows = await prisma.branchStock.findMany({
      where: { businessId: scope.businessId, branchId: scope.branchId },
      include: { product: { select: { purchasePrice: true, sellingPrice: true, minStock: true, status: true } } },
    });
    let costValue = 0, retailValue = 0, lowStockCount = 0, outOfStockCount = 0;
    for (const r of rows) {
      const q = Number(r.quantity);
      const p = r.product;
      if (p.status !== "ACTIVE") continue;
      costValue = add(costValue, round2(q * p.purchasePrice.toNumber()));
      retailValue = add(retailValue, round2(q * p.sellingPrice.toNumber()));
      if (q <= 0) outOfStockCount += 1;
      else if (q <= p.minStock.toNumber()) lowStockCount += 1;
    }
    return {
      productCount: rows.length,
      costValue: round2(costValue),
      retailValue: round2(retailValue),
      potentialProfit: sub(retailValue, costValue),
      lowStockCount,
      outOfStockCount,
    };
  }

  const products = await prisma.product.findMany({
    where: { businessId: scope.businessId, status: "ACTIVE" },
    select: { currentStock: true, purchasePrice: true, sellingPrice: true, minStock: true },
  });
  let costValue = 0, retailValue = 0, lowStockCount = 0, outOfStockCount = 0;
  for (const p of products) {
    const q = p.currentStock.toNumber();
    costValue = add(costValue, round2(q * p.purchasePrice.toNumber()));
    retailValue = add(retailValue, round2(q * p.sellingPrice.toNumber()));
    if (q <= 0) outOfStockCount += 1;
    else if (q <= p.minStock.toNumber()) lowStockCount += 1;
  }
  return {
    productCount: products.length,
    costValue: round2(costValue),
    retailValue: round2(retailValue),
    potentialProfit: sub(retailValue, costValue),
    lowStockCount,
    outOfStockCount,
  };
}

async function listTransactions(scope, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId: scope.businessId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.type ? { type: query.type } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true, sku: true, unit: true } } },
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);
  return {
    items: items.map((t) => ({
      ...t,
      quantity: t.quantity.toNumber(),
      balanceAfter: t.balanceAfter.toNumber(),
      product: t.product,
    })),
    meta: buildMeta({ page, limit }, total),
  };
}

// ---------- Manual operations ----------

async function adjustStock(scope, user, data) {
  return prisma.$transaction(async (tx) => {
    await lockProduct(tx, scope.businessId, data.productId);
    const product = await tx.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new ApiError(404, "Product not found");

    const current = await getBranchStock(tx, scope.branchId, data.productId);
    let next = current;
    if (data.type === "STOCK_IN") next = round2(current + data.quantity);
    else if (data.type === "STOCK_OUT") {
      next = round2(current - data.quantity);
      if (next < 0) throw new ApiError(400, `Insufficient stock in this branch. Available: ${current} ${product.unit}`);
    } else {
      next = round2(data.quantity);
    }

    const delta = round2(next - current);
    await applyStockChange(tx, {
      businessId: scope.businessId,
      branchId: scope.branchId,
      productId: product.id,
      type: data.type,
      quantity: Math.abs(delta),
      branchBalanceAfter: next,
      referenceType: "MANUAL",
      note: data.note || null,
      userId: user.id,
    });

    await checkLowStockAndNotify(tx, scope.businessId, product.id, next);
    return { productId: product.id, branchId: scope.branchId, previousBalance: current, balanceAfter: next };
  });
}

/**
 * Stock transfer: moves quantity from one branch to another. The business-wide
 * total is unchanged; only the two BranchStock rows move.
 */
async function transferStock(scope, user, data) {
  return prisma.$transaction(async (tx) => {
    await lockProduct(tx, scope.businessId, data.productId);
    const product = await tx.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new ApiError(404, "Product not found");

    const src = await getBranchStock(tx, data.fromBranchId, data.productId);
    if (src < data.quantity) {
      throw new ApiError(400, `Insufficient stock at source branch. Available: ${src} ${product.unit}`);
    }
    const dstCurrent = await getBranchStock(tx, data.toBranchId, data.productId);
    const srcNext = round2(src - data.quantity);
    const dstNext = round2(dstCurrent + data.quantity);

    await tx.branchStock.upsert({
      where: { branchId_productId: { branchId: data.fromBranchId, productId: product.id } },
      create: { businessId: scope.businessId, branchId: data.fromBranchId, productId: product.id, quantity: srcNext },
      update: { quantity: srcNext },
    });
    await tx.branchStock.upsert({
      where: { branchId_productId: { branchId: data.toBranchId, productId: product.id } },
      create: { businessId: scope.businessId, branchId: data.toBranchId, productId: product.id, quantity: dstNext },
      update: { quantity: dstNext },
    });
    await recomputeTotal(tx, scope.businessId, product.id);

    await tx.inventoryTransaction.create({
      data: {
        businessId: scope.businessId, branchId: data.fromBranchId, productId: product.id,
        type: "TRANSFER_OUT", quantity: Decimal(data.quantity), balanceAfter: Decimal(srcNext),
        referenceType: "TRANSFER", note: `Transfer to branch ${data.toBranchId}${data.note ? ` — ${data.note}` : ""}`, createdBy: user.id,
      },
    });
    await tx.inventoryTransaction.create({
      data: {
        businessId: scope.businessId, branchId: data.toBranchId, productId: product.id,
        type: "TRANSFER_IN", quantity: Decimal(data.quantity), balanceAfter: Decimal(dstNext),
        referenceType: "TRANSFER", note: `Transfer from branch ${data.fromBranchId}${data.note ? ` — ${data.note}` : ""}`, createdBy: user.id,
      },
    });

    await checkLowStockAndNotify(tx, scope.businessId, product.id, srcNext);
    return { productId: product.id, fromBranchId: data.fromBranchId, toBranchId: data.toBranchId, quantity: data.quantity };
  });
}

/** Fires a LOW_STOCK notification once per product while it stays low. */
async function checkLowStockAndNotify(tx, businessId, productId, newBalance) {
  const business = await tx.business.findUnique({
    where: { id: businessId },
    select: { lowStockAlertsEnabled: true },
  });
  if (!business?.lowStockAlertsEnabled) return;

  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { name: true, sku: true, minStock: true, unit: true },
  });
  if (!product) return;
  const minStock = product.minStock.toNumber();
  if (newBalance > minStock) return;

  const existing = await tx.notification.findFirst({
    where: { businessId, type: "LOW_STOCK", link: `/products/${productId}`, isRead: false },
  });
  if (existing) return;

  await tx.notification.create({
    data: {
      businessId,
      type: "LOW_STOCK",
      title: newBalance <= 0 ? `Out of stock: ${product.name}` : `Low stock: ${product.name}`,
      message:
        newBalance <= 0
          ? `${product.name} (${product.sku}) is out of stock.`
          : `${product.name} (${product.sku}) has ${newBalance} ${product.unit} left, minimum is ${minStock}.`,
      link: `/products?search=${encodeURIComponent(product.sku)}`,
    },
  });
}

module.exports = {
  applyStockChange,
  loadBranchStockMap,
  recomputeTotal,
  listInventory,
  stockValuation,
  listTransactions,
  adjustStock,
  transferStock,
  checkLowStockAndNotify,
};
