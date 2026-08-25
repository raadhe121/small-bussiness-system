const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { round2, add } = require("../utils/money");

// ---------- Categories ----------

async function listCategories(businessId, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId,
    ...(query.search
      ? { name: { contains: query.search } }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    prisma.category.count({ where }),
  ]);
  return { items: items.map((c) => ({ ...c, productCount: c._count.products })), meta: buildMeta({ page, limit }, total) };
}

async function createCategory(businessId, data) {
  const dup = await prisma.category.findUnique({
    where: { businessId_name: { businessId, name: data.name } },
  });
  if (dup) throw new ApiError(409, "A category with this name already exists");
  return prisma.category.create({ data: { businessId, name: data.name, description: data.description || null } });
}

async function updateCategory(businessId, id, data) {
  const existing = await prisma.category.findFirst({ where: { id, businessId } });
  if (!existing) throw new ApiError(404, "Category not found");
  if (data.name && data.name !== existing.name) {
    const dup = await prisma.category.findUnique({
      where: { businessId_name: { businessId, name: data.name } },
    });
    if (dup) throw new ApiError(409, "A category with this name already exists");
  }
  return prisma.category.update({ where: { id }, data });
}

async function deleteCategory(businessId, id) {
  const existing = await prisma.category.findFirst({ where: { id, businessId } });
  if (!existing) throw new ApiError(404, "Category not found");
  await prisma.category.delete({ where: { id } });
}

// ---------- Products ----------

const productInclude = {
  category: { select: { id: true, name: true } },
};

function serializeProduct(p) {
  return {
    ...p,
    purchasePrice: p.purchasePrice.toNumber(),
    sellingPrice: p.sellingPrice.toNumber(),
    taxRate: p.taxRate.toNumber(),
    minStock: p.minStock.toNumber(),
    currentStock: p.currentStock.toNumber(),
    isLowStock: p.currentStock.lte(p.minStock),
  };
}

async function listProducts(businessId, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId,
    ...(query.search ? { OR: [
      { name: { contains: query.search } },
      { sku: { contains: query.search } },
      { barcode: { contains: query.search } },
    ] } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.lowStock ? { currentStock: { lte: prisma.product.fields.minStock } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }], include: productInclude }),
    prisma.product.count({ where }),
  ]);
  return { items: items.map(serializeProduct), meta: buildMeta({ page, limit }, total) };
}

async function getProduct(businessId, id) {
  const p = await prisma.product.findFirst({ where: { id, businessId }, include: productInclude });
  if (!p) throw new ApiError(404, "Product not found");
  return serializeProduct(p);
}

/**
 * Creates a product. `openingStock` (if > 0) creates the product with stock
 * and records an initial STOCK_IN inventory transaction.
 */
async function createProduct(businessId, userId, data) {
  const skuDup = await prisma.product.findUnique({ where: { businessId_sku: { businessId, sku: data.sku } } });
  if (skuDup) throw new ApiError(409, "A product with this SKU already exists");

  const openingStock = data.openingStock ?? data.currentStock ?? 0;
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        businessId,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode || null,
        description: data.description || null,
        categoryId: data.categoryId || null,
        unit: data.unit,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
        taxRate: data.taxRate,
        minStock: data.minStock,
        currentStock: openingStock,
        imageUrl: data.imageUrl || null,
        status: data.status,
      },
    });

    if (openingStock > 0) {
      await tx.inventory.create({
        data: { businessId, productId: created.id, quantity: openingStock },
      });
      await tx.inventoryTransaction.create({
        data: {
          businessId, productId: created.id, type: "STOCK_IN",
          quantity: openingStock, balanceAfter: openingStock,
          referenceType: "OPENING", createdBy: userId,
          note: "Opening stock",
        },
      });
    }
    return created;
  });
  return getProduct(businessId, product.id);
}

async function updateProduct(businessId, id, data) {
  const existing = await prisma.product.findFirst({ where: { id, businessId } });
  if (!existing) throw new ApiError(404, "Product not found");

  if (data.sku && data.sku !== existing.sku) {
    const dup = await prisma.product.findUnique({ where: { businessId_sku: { businessId, sku: data.sku } } });
    if (dup) throw new ApiError(409, "A product with this SKU already exists");
  }

  // currentStock changes go through inventory adjustments, not direct edits.
  const { currentStock, openingStock, ...rest } = data;
  await prisma.product.update({
    where: { id },
    data: {
      ...rest,
      ...(rest.barcode !== undefined ? { barcode: rest.barcode || null } : {}),
      ...(rest.description !== undefined ? { description: rest.description || null } : {}),
      ...(rest.imageUrl !== undefined ? { imageUrl: rest.imageUrl || null } : {}),
      ...(data.categoryId === undefined ? {} : { categoryId: data.categoryId || null }),
    },
  });
  return getProduct(businessId, id);
}

/** Soft-delete guard: block deletion when the product has transaction history. */
async function deleteProduct(businessId, id) {
  const existing = await prisma.product.findFirst({ where: { id, businessId } });
  if (!existing) throw new ApiError(404, "Product not found");

  const [sales, purchases] = await Promise.all([
    prisma.saleItem.count({ where: { productId: id, sale: { businessId } } }),
    prisma.purchaseItem.count({ where: { productId: id, purchase: { businessId } } }),
  ]);
  if (sales > 0 || purchases > 0) {
    throw new ApiError(409, "This product has sales/purchase history and cannot be deleted. Set it to inactive instead.");
  }
  await prisma.product.delete({ where: { id } });
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  serializeProduct,
};
