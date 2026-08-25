const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { buildMeta, parsePagination } = require("../utils/pagination");

async function listBranches(businessId, query = {}) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId,
    ...(query.activeOnly === "true" || query.activeOnly === true ? { isActive: true } : {}),
    ...(query.search ? { name: { contains: query.search } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.branch.findMany({ where, skip, take, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    prisma.branch.count({ where }),
  ]);
  const stats = await prisma.branchStock.groupBy({
    by: ["branchId"],
    where: { businessId },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(stats.map((s) => [s.branchId, s._count._all]));
  return {
    items: items.map((b) => ({ ...b, productCount: counts[b.id] || 0 })),
    meta: buildMeta({ page, limit }, total),
  };
}

async function getBranch(businessId, id) {
  const branch = await prisma.branch.findFirst({ where: { businessId, id } });
  if (!branch) throw new ApiError(404, "Branch not found");
  return branch;
}

async function createBranch(businessId, data) {
  const count = await prisma.branch.count({ where: { businessId } });
  const existingDefault = await prisma.branch.findFirst({ where: { businessId, isDefault: true } });
  const isDefault = data.isDefault ? true : count === 0 && !existingDefault;

  if (isDefault) {
    await prisma.branch.updateMany({ where: { businessId, isDefault: true }, data: { isDefault: false } });
  }

  const branch = await prisma.branch.create({
    data: {
      businessId,
      name: data.name,
      code: data.code || null,
      address: data.address || null,
      phone: data.phone || null,
      isDefault,
    },
  });
  return branch;
}

async function updateBranch(businessId, id, data) {
  const branch = await getBranch(businessId, id);
  if (data.isDefault && !branch.isDefault) {
    await prisma.branch.updateMany({ where: { businessId, isDefault: true }, data: { isDefault: false } });
  }
  if (data.isDefault === false && branch.isDefault) {
    throw new ApiError(400, "A business must have at least one default branch");
  }
  return prisma.branch.update({
    where: { id },
    data: {
      name: data.name ?? branch.name,
      code: data.code !== undefined ? data.code : branch.code,
      address: data.address !== undefined ? data.address : branch.address,
      phone: data.phone !== undefined ? data.phone : branch.phone,
      isActive: data.isActive !== undefined ? data.isActive : branch.isActive,
      isDefault: data.isDefault !== undefined ? data.isDefault : branch.isDefault,
    },
  });
}

async function deleteBranch(businessId, id) {
  const branch = await getBranch(businessId, id);
  if (branch.isDefault) throw new ApiError(400, "Cannot delete the default branch");
  const stock = await prisma.branchStock.findFirst({ where: { businessId, branchId: id, quantity: { gt: 0 } } });
  if (stock) throw new ApiError(400, "Transfer or sell out stock in this branch before deleting it");
  await prisma.user.updateMany({ where: { businessId, branchId: id }, data: { branchId: null } });
  await prisma.branch.delete({ where: { id } });
  return { id };
}

/**
 * Returns the business's default branch, lazily creating one ("Main") if the
 * business was created before the multi-branch feature (so stock/inventory
 * operations always have a branch to write against).
 */
async function getOpBranch(businessId) {
  let branch = await prisma.branch.findFirst({ where: { businessId, isDefault: true } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { businessId, name: "Main", code: "MAIN", isDefault: true },
    });
  }
  return branch;
}

module.exports = { listBranches, getBranch, createBranch, updateBranch, deleteBranch, getOpBranch };
