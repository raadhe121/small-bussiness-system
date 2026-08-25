const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { parsePagination, buildMeta } = require("../utils/pagination");

/** Cross-tenant platform admin service — the DukaanSetu back-office. */

// ---- Overview ----

async function getOverview() {
  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalBusinesses,
    activeBusinesses,
    newBusinesses,
    totalUsers,
    totalOwners,
    totalSales,
    revenueAgg,
    todaySales,
    totalProducts,
    totalCustomers,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { isActive: true } }),
    prisma.business.count({ where: { createdAt: { gte: since30d } } }),
    prisma.user.count({ where: { isPlatformAdmin: false } }),
    prisma.user.count({ where: { role: "OWNER", isPlatformAdmin: false } }),
    prisma.sale.count(),
    prisma.sale.aggregate({ _sum: { grandTotal: true } }),
    prisma.sale.aggregate({
      _sum: { grandTotal: true },
      _count: true,
      where: { saleDate: { gte: startOfToday } },
    }),
    prisma.product.count(),
    prisma.customer.count(),
  ]);

  const recentBusinesses = await prisma.business.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true, name: true, ownerName: true, city: true, state: true,
      isActive: true, createdAt: true,
      users: { where: { role: "OWNER" }, select: { email: true }, take: 1 },
      _count: { select: { users: true, sales: true } },
    },
  });

  return {
    stats: {
      totalBusinesses,
      activeBusinesses,
      inactiveBusinesses: totalBusinesses - activeBusinesses,
      newBusinesses30d: newBusinesses,
      totalUsers,
      totalOwners,
      totalSales,
      totalRevenue: Number(revenueAgg._sum.grandTotal || 0),
      todaySales: todaySales._count || 0,
      todayRevenue: Number(todaySales._sum.grandTotal || 0),
      totalProducts,
      totalCustomers,
    },
    recentBusinesses: recentBusinesses.map((b) => ({
      id: b.id,
      name: b.name,
      ownerName: b.ownerName,
      location: [b.city, b.state].filter(Boolean).join(", ") || null,
      isActive: b.isActive,
      createdAt: b.createdAt,
      ownerEmail: b.users[0]?.email || null,
      userCount: b._count.users,
      salesCount: b._count.sales,
    })),
  };
}

// ---- Businesses ----

function businessSearchWhere(search) {
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search } },
      { ownerName: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
      { gstin: { contains: search } },
      { city: { contains: search } },
    ],
  };
}

async function listBusinesses(query = {}) {
  const { skip, take, page, limit } = parsePagination(query);
  const where = {
    ...businessSearchWhere(query.search?.trim()),
    ...(query.status === "active" ? { isActive: true } : {}),
    ...(query.status === "inactive" ? { isActive: false } : {}),
  };

  const [total, businesses] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true, name: true, ownerName: true, phone: true, email: true,
        city: true, state: true, gstin: true, businessType: true,
        isActive: true, createdAt: true,
        users: { where: { role: "OWNER" }, select: { id: true, name: true, email: true, isActive: true }, take: 1 },
        _count: { select: { users: true, products: true, sales: true, customers: true } },
      },
    }),
  ]);

  return {
    meta: buildMeta({ page, limit }, total),
    items: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      ownerName: b.ownerName,
      phone: b.phone,
      email: b.email,
      location: [b.city, b.state].filter(Boolean).join(", ") || null,
      gstin: b.gstin,
      businessType: b.businessType,
      isActive: b.isActive,
      createdAt: b.createdAt,
      owner: b.users[0] || null,
      counts: {
        users: b._count.users,
        products: b._count.products,
        sales: b._count.sales,
        customers: b._count.customers,
      },
    })),
  };
}

async function getBusinessDetail(id) {
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      users: {
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
        select: {
          id: true, name: true, email: true, role: true, isActive: true,
          lastLoginAt: true, createdAt: true,
        },
      },
      _count: {
        select: {
          products: true, customers: true, suppliers: true,
          sales: true, purchases: true, expenses: true, payments: true, roles: true,
        },
      },
    },
  });
  if (!business) throw new ApiError(404, "Business not found");

  const revenueAgg = await prisma.sale.aggregate({
    _sum: { grandTotal: true },
    where: { businessId: id },
  });

  const recentSales = await prisma.sale.findMany({
    where: { businessId: id },
    orderBy: { saleDate: "desc" },
    take: 5,
    select: { id: true, invoiceNo: true, grandTotal: true, saleDate: true },
  });

  const { _count, ...biz } = business;
  return {
    business: biz,
    counts: _count,
    totalRevenue: Number(revenueAgg._sum.grandTotal || 0),
    recentSales,
  };
}

async function updateBusiness(id, data) {
  const existing = await prisma.business.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Business not found");

  const payload = {};
  for (const key of ["name", "ownerName", "phone", "email", "gstin", "isActive"]) {
    if (data[key] !== undefined) payload[key] = data[key];
  }
  if (payload.email === "") payload.email = null;
  if (payload.gstin === "") payload.gstin = null;

  return prisma.business.update({ where: { id }, data: payload });
}

async function deleteBusiness(id) {
  const existing = await prisma.business.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Business not found");

  // Explicit cascade order so MySQL FKs (e.g. SaleItem -> Product Restrict) never block.
  await prisma.$transaction([
    prisma.saleItem.deleteMany({ where: { sale: { businessId: id } } }),
    prisma.purchaseItem.deleteMany({ where: { purchase: { businessId: id } } }),
    prisma.notification.deleteMany({ where: { businessId: id } }),
    prisma.inventoryTransaction.deleteMany({ where: { businessId: id } }),
    prisma.customerTransaction.deleteMany({ where: { businessId: id } }),
    prisma.supplierTransaction.deleteMany({ where: { businessId: id } }),
    prisma.payment.deleteMany({ where: { businessId: id } }),
    prisma.expense.deleteMany({ where: { businessId: id } }),
    prisma.expenseCategory.deleteMany({ where: { businessId: id } }),
    prisma.inventory.deleteMany({ where: { businessId: id } }),
    prisma.sale.deleteMany({ where: { businessId: id } }),
    prisma.purchase.deleteMany({ where: { businessId: id } }),
    prisma.customer.deleteMany({ where: { businessId: id } }),
    prisma.supplier.deleteMany({ where: { businessId: id } }),
    prisma.product.deleteMany({ where: { businessId: id } }),
    prisma.category.deleteMany({ where: { businessId: id } }),
    prisma.role.deleteMany({ where: { businessId: id } }),
    prisma.user.deleteMany({ where: { businessId: id } }),
    prisma.business.delete({ where: { id } }),
  ]);
  return { id };
}

// ---- Users (across all tenants) ----

async function listUsers(query = {}) {
  const { skip, take, page, limit } = parsePagination(query);
  const search = query.search?.trim();
  const where = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.businessId ? { businessId: query.businessId } : {}),
    ...(query.status === "active" ? { isActive: true } : {}),
    ...(query.status === "disabled" ? { isActive: false } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take,
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        isPlatformAdmin: true, isActive: true, lastLoginAt: true, createdAt: true,
        business: { select: { id: true, name: true } },
      },
    }),
  ]);

  return { meta: buildMeta({ page, limit }, total), items: users };
}

async function findManagedUser(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, phone: true, role: true,
      isPlatformAdmin: true, isActive: true, businessId: true,
      business: { select: { id: true, name: true } },
    },
  });
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

function assertManageable(actor, target) {
  if (target.isPlatformAdmin) {
    throw new ApiError(403, "Platform administrator accounts cannot be managed here");
  }
  if (target.id === actor.id) {
    throw new ApiError(400, "You cannot manage your own account from the platform panel");
  }
}

async function setUserStatus(actor, userId, isActive) {
  const target = await findManagedUser(userId);
  assertManageable(actor, target);
  return prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: { id: true, isActive: true },
  });
}

async function changeUserRole(actor, userId, role) {
  const target = await findManagedUser(userId);
  assertManageable(actor, target);
  return prisma.user.update({
    where: { id: userId },
    data: { role, customRoleId: null },
    select: { id: true, role: true },
  });
}

async function deleteUser(actor, userId) {
  const target = await findManagedUser(userId);
  assertManageable(actor, target);
  await prisma.user.delete({ where: { id: userId } });
  return { id: userId };
}

module.exports = {
  getOverview,
  listBusinesses,
  getBusinessDetail,
  updateBusiness,
  deleteBusiness,
  listUsers,
  setUserStatus,
  changeUserRole,
  deleteUser,
};
