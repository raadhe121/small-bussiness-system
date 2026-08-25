const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const bcrypt = require("bcryptjs");
const { issueToken, publicUser } = require("./auth.service");

const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent", "Electricity", "Salaries", "Transport",
  "Packaging", "Marketing", "Maintenance", "Miscellaneous",
];

/**
 * Creates the tenant business for the current user, makes them OWNER,
 * and seeds default expense categories. Idempotent per user.
 */
async function createBusiness(user, data) {
  if (user.businessId) throw new ApiError(409, "You already belong to a business");

  const business = await prisma.$transaction(async (tx) => {
    const biz = await tx.business.create({
      data: {
        name: data.name,
        ownerName: data.ownerName,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        gstin: data.gstin || null,
        businessType: data.businessType,
        currency: data.currency || "INR",
        invoicePrefix: (data.invoicePrefix || "INV").toUpperCase(),
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { businessId: biz.id, role: "OWNER" },
    });

    await tx.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ businessId: biz.id, name })),
    });

    return biz;
  });

  return { business, token: issueToken({ id: user.id, role: "OWNER", businessId: business.id }) };
}

async function getBusiness(businessId) {
  return prisma.business.findUnique({ where: { id: businessId } });
}

async function updateSettings(businessId, data) {
  const payload = {};
  for (const key of [
    "name", "ownerName", "phone", "email", "address", "city", "state",
    "pincode", "gstin", "businessType", "currency", "invoicePrefix",
    "logoUrl", "invoiceTerms", "upiId", "bankDetails", "defaultGstRate",
    "lowStockAlertsEnabled", "paymentDueAlertsEnabled",
  ]) {
    if (data[key] !== undefined) {
      payload[key] = data[key] === "" ? null : data[key];
    }
  }
  if (payload.invoicePrefix) payload.invoicePrefix = String(payload.invoicePrefix).toUpperCase();
  return prisma.business.update({ where: { id: businessId }, data: payload });
}

// ---- Users management (tenant-scoped) ----

async function listUsers(businessId) {
  const users = await prisma.user.findMany({
    where: { businessId },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, name: true, email: true, phone: true, role: true,
      customRoleId: true,
      customRole: { select: { id: true, name: true } },
      isActive: true, lastLoginAt: true, createdAt: true,
    },
  });
  return users;
}

/** Validates a roleId belongs to this business; throws if not. */
async function validateRole(businessId, roleId) {
  if (!roleId) return null;
  const role = await prisma.role.findFirst({ where: { id: roleId, businessId } });
  if (!role) throw new ApiError(400, "Selected role does not exist in your business");
  return role.id;
}

async function createUser(actor, data) {
  // Assigning roles (built-in or custom) is reserved for the OWNER.
  let role = data.role;
  let customRoleId = null;
  if (actor.role !== "OWNER") {
    throw new ApiError(403, "Only the business owner can add team members");
  }
  if (data.roleId) {
    customRoleId = await validateRole(actor.businessId, data.roleId);
    role = undefined;
  }
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new ApiError(409, "A user with this email already exists");
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      passwordHash: await bcrypt.hash(data.password, 12),
      ...(role ? { role } : {}),
      ...(customRoleId ? { customRoleId } : {}),
      businessId: actor.businessId,
    },
  });
  const { passwordHash, ...safe } = user;
  return safe;
}

async function updateUser(actor, userId, data) {
  const target = await prisma.user.findFirst({ where: { id: userId, businessId: actor.businessId } });
  if (!target) throw new ApiError(404, "User not found");

  // Only the OWNER can touch other OWNER/ADMIN accounts.
  if (actor.role !== "OWNER" && ["OWNER", "ADMIN"].includes(target.role)) {
    throw new ApiError(403, "Only the business owner can modify admin accounts");
  }
  // Users can never demote or disable themselves.
  if (target.id === actor.id && (data.isActive === false)) {
    throw new ApiError(400, "You cannot disable your own account");
  }

  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.phone !== undefined) payload.phone = data.phone || null;
  if (data.isActive !== undefined) payload.isActive = data.isActive;

  // Role changes — built-in OR custom — are owner-only.
  if (data.roleId !== undefined || data.role !== undefined) {
    if (actor.role !== "OWNER") {
      throw new ApiError(403, "Only the business owner can change a member's role");
    }
    if (data.roleId === null) {
      payload.customRoleId = null;
    } else if (data.roleId) {
      payload.customRoleId = await validateRole(actor.businessId, data.roleId);
      payload.role = target.role === "OWNER" ? "OWNER" : "EMPLOYEE";
    } else if (data.role) {
      payload.role = data.role;
      payload.customRoleId = null;
    }
  }

  await prisma.user.update({ where: { id: target.id }, data: payload });
  return prisma.user.findUnique({
    where: { id: target.id },
    select: { id: true, name: true, email: true, phone: true, role: true, customRoleId: true, customRole: { select: { id: true, name: true } }, isActive: true, lastLoginAt: true },
  });
}

/** Employee activity log architecture: recent records created by this user. */
async function getUserActivity(businessId, userId) {
  const [salesCount, purchaseCount, paymentCount, expenseCount, recentSales] =
    await Promise.all([
      prisma.sale.count({ where: { businessId, createdById: userId } }),
      prisma.purchase.count({ where: { businessId, createdById: userId } }),
      prisma.payment.count({ where: { businessId, createdById: userId } }),
      prisma.expense.count({ where: { businessId, createdById: userId } }),
      prisma.sale.findMany({
        where: { businessId, createdById: userId },
        orderBy: { saleDate: "desc" },
        take: 10,
        select: { id: true, invoiceNo: true, grandTotal: true, saleDate: true },
      }),
    ]);
  return { counts: { sales: salesCount, purchases: purchaseCount, payments: paymentCount, expenses: expenseCount }, recentSales };
}

module.exports = {
  createBusiness,
  getBusiness,
  updateSettings,
  listUsers,
  createUser,
  updateUser,
  getUserActivity,
};
