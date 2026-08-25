const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { round2, add, sub } = require("../utils/money");

/**
 * Inventory service.
 * All stock mutations happen inside Prisma transactions and write an
 * InventoryTransaction row for a complete audit history. Product rows are
 * locked with SELECT ... FOR UPDATE to prevent concurrent overselling.
 */

async function lockProduct(tx, businessId, productId) {
  const rows = await tx.$queryRaw`
    SELECT id FROM "Product" WHERE id = ${productId} AND "businessId" = ${businessId} FOR UPDATE
  `;
  if (!rows.length) throw new ApiError(404, "Product not found");
}

/** Applies a stock delta and writes the audit transaction. */
async function applyStockChange(tx, { businessId, productId, type, quantity, balanceAfter, referenceType, referenceId, note, userId }) {
  const D = (v) => new (require("@prisma/client").Prisma.Decimal)(String(v));
  await tx.product.update({
    where: { id: productId },
    data: { currentStock: D(balanceAfter) },
  });
  await tx.inventory.upsert({
    where: { productId },
    create: { businessId, productId, quantity: balanceAfter },
    update: { quantity: balanceAfter },
  });
  await tx.inventoryTransaction.create({
    data: {
      businessId,
      productId,
      type,
      quantity: D(quantity),
      balanceAfter: D(balanceAfter),
      referenceType: referenceType || null,
      referenceId: referenceId || null,
      note: note || null,
      createdBy: userId,
    },
  });
}

// ---------- Queries ----------

async function listInventory(businessId, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId,
    ...(query.search ? {
      product: {
        OR: [{ name: { contains: query.search } }, { sku: { contains: query.search } }],
      },
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

  const rows = items.map((inv) => ({
    id: inv.id,
    productId: inv.product.id,
    productName: inv.product.name,
    sku: inv.product.sku,
    unit: inv.product.unit,
    categoryName: inv.product.category?.name || null,
    quantity: inv.product.currentStock.toNumber(),
    minStock: inv.product.minStock.toNumber(),
    purchasePrice: inv.product.purchasePrice.toNumber(),
    sellingPrice: inv.product.sellingPrice.toNumber(),
    stockValue: round2(inv.product.currentStock.toNumber() * inv.product.purchasePrice.toNumber()),
    isLowStock: inv.product.currentStock.lte(inv.product.minStock),
    status: inv.product.status,
    updatedAt: inv.updatedAt,
  }));

  return { items: rows, meta: buildMeta({ page, limit }, total) };
}

async function stockValuation(businessId) {
  const products = await prisma.product.findMany({
    where: { businessId, status: "ACTIVE" },
    select: { currentStock: true, purchasePrice: true, sellingPrice: true, minStock: true },
  });
  let costValue = 0;
  let retailValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
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

async function listTransactions(businessId, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId,
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

async function adjustStock(businessId, user, data) {
  return prisma.$transaction(async (tx) => {
    await lockProduct(tx, businessId, data.productId);
    const product = await tx.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new ApiError(404, "Product not found");

    const current = product.currentStock.toNumber();
    let next = current;

    if (data.type === "STOCK_IN") next = round2(current + data.quantity);
    else if (data.type === "STOCK_OUT") {
      next = round2(current - data.quantity);
      if (next < 0) throw new ApiError(400, `Insufficient stock. Available: ${current} ${product.unit}`);
    } else {
      // ADJUSTMENT sets absolute counted quantity
      next = round2(data.quantity);
    }

    const delta = data.type === "ADJUSTMENT" ? round2(next - current) : round2(next - current);
    await applyStockChange(tx, {
      businessId,
      productId: product.id,
      type: data.type,
      quantity: Math.abs(delta),
      balanceAfter: next,
      referenceType: "MANUAL",
      note: data.note || null,
      userId: user.id,
    });

    await checkLowStockAndNotify(tx, businessId, product.id, next);
    return { productId: product.id, previousBalance: current, balanceAfter: next };
  });
}

/**
 * Stock transfer architecture — moves quantity between locations.
 * With a single location this re-tags the inventory location; when multiple
 * warehouses are introduced each location gets its own Inventory row and this
 * becomes TRANSFER_OUT at source + TRANSFER_IN at destination.
 */
async function transferStock(businessId, user, data) {
  return prisma.$transaction(async (tx) => {
    await lockProduct(tx, businessId, data.productId);
    const product = await tx.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new ApiError(404, "Product not found");

    await tx.inventory.update({
      where: { productId: product.id },
      data: { location: data.toLocation },
    });
    await tx.inventoryTransaction.create({
      data: {
        businessId,
        productId: product.id,
        type: "TRANSFER_IN",
        quantity: data.quantity,
        balanceAfter: product.currentStock.toNumber(),
        referenceType: "TRANSFER",
        note: `Transferred to ${data.toLocation}${data.note ? ` — ${data.note}` : ""}`,
        createdBy: user.id,
      },
    });
    return { productId: product.id, location: data.toLocation };
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
  listInventory,
  stockValuation,
  listTransactions,
  adjustStock,
  transferStock,
  checkLowStockAndNotify,
};
