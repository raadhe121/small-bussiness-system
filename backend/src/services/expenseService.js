const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { paginate } = require("../utils/paginate");
const { D } = require("../utils/money");

// ---------- expense categories ----------

async function listCategories(businessId) {
  return prisma.expenseCategory.findMany({
    where: { businessId },
    include: { _count: { select: { expenses: true } } },
    orderBy: { name: "asc" },
  });
}

async function createCategory(businessId, data) {
  const existing = await prisma.expenseCategory.findFirst({ where: { businessId, name: data.name } });
  if (existing) throw new ApiError(409, "Category already exists");
  return prisma.expenseCategory.create({ data: { businessId, name: data.name } });
}

async function removeCategory(businessId, id) {
  const cat = await prisma.expenseCategory.findFirst({ where: { id, businessId }, include: { _count: true } });
  if (!cat) throw new ApiError(404, "Category not found");
  if (cat._count.expenses > 0) throw new ApiError(400, "Cannot delete a category that has expenses");
  await prisma.expenseCategory.delete({ where: { id } });
  return { deleted: true };
}

// ---------- expenses ----------

async function list(businessId, { page, limit, expenseCategoryId, from, to }) {
  const where = { businessId };
  if (expenseCategoryId) where.expenseCategoryId = expenseCategoryId;
  const dateFilter = {};
  if (from) dateFilter.gte = from;
  if (to) dateFilter.lte = to;
  if (Object.keys(dateFilter).length) where.expenseDate = dateFilter;

  const [total, items] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      include: { expenseCategory: { select: { name: true } }, creator: { select: { name: true } } },
      orderBy: { expenseDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return paginate(items, total, page, limit);
}

async function create(businessId, userId, data) {
  const cat = await prisma.expenseCategory.findFirst({
    where: { id: data.expenseCategoryId, businessId },
  });
  if (!cat) throw new ApiError(404, "Expense category not found");
  return prisma.expense.create({
    data: {
      businessId,
      expenseCategoryId: data.expenseCategoryId,
      amount: D(data.amount),
      method: data.method,
      reference: data.reference || null,
      receiptUrl: data.receiptUrl || null,
      description: data.description || null,
      expenseDate: data.expenseDate || new Date(),
      createdById: userId,
    },
  });
}

async function update(businessId, id, data) {
  const expense = await prisma.expense.findFirst({ where: { id, businessId } });
  if (!expense) throw new ApiError(404, "Expense not found");
  const patch = {};
  if (data.expenseCategoryId) {
    const cat = await prisma.expenseCategory.findFirst({ where: { id: data.expenseCategoryId, businessId } });
    if (!cat) throw new ApiError(404, "Expense category not found");
    patch.expenseCategoryId = cat.id;
  }
  if (data.amount !== undefined) patch.amount = D(data.amount);
  if (data.method !== undefined) patch.method = data.method;
  for (const f of ["reference", "description"]) if (data[f] !== undefined) patch[f] = data[f] || null;
  if (data.receiptUrl !== undefined) patch.receiptUrl = data.receiptUrl || null;
  if (data.expenseDate) patch.expenseDate = data.expenseDate;
  return prisma.expense.update({ where: { id }, data: patch });
}

async function remove(businessId, id) {
  const expense = await prisma.expense.findFirst({ where: { id, businessId } });
  if (!expense) throw new ApiError(404, "Expense not found");
  await prisma.expense.delete({ where: { id } });
  return { deleted: true };
}

module.exports = {
  listCategories, createCategory, removeCategory,
  list, create, update, remove,
};
