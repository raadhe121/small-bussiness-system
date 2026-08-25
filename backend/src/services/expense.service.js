const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { resolveReadScope, resolveWriteBranch } = require("../utils/branchScope");

/** Expenses & expense categories. */

function serializeExpense(e) {
  return {
    ...e,
    amount: e.amount.toNumber(),
    expenseCategory: e.expenseCategory,
    branchId: e.branchId ?? null,
    branchName: e.branch?.name ?? null,
  };
}

async function listExpenseCategories(businessId) {
  const items = await prisma.expenseCategory.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
    include: { _count: { select: { expenses: true } } },
  });
  return items.map((c) => ({ id: c.id, name: c.name, expenseCount: c._count.expenses }));
}

async function createExpenseCategory(businessId, data) {
  const dup = await prisma.expenseCategory.findUnique({ where: { businessId_name: { businessId, name: data.name } } });
  if (dup) throw new ApiError(409, "An expense category with this name already exists");
  const cat = await prisma.expenseCategory.create({ data: { businessId, name: data.name } });
  return { id: cat.id, name: cat.name, expenseCount: 0 };
}

async function deleteExpenseCategory(businessId, id) {
  const existing = await prisma.expenseCategory.findFirst({ where: { id, businessId } });
  if (!existing) throw new ApiError(404, "Expense category not found");
  const count = await prisma.expense.count({ where: { expenseCategoryId: id } });
  if (count > 0) throw new ApiError(409, "This category has expenses recorded against it and cannot be deleted");
  await prisma.expenseCategory.delete({ where: { id } });
}

async function listExpenses(scope, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId: scope.businessId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(query.search ? {
      OR: [
        { description: { contains: query.search } },
        { reference: { contains: query.search } },
        ...(query.search.length >= 3 ? [{ expenseCategory: { name: { contains: query.search } } }] : []),
      ],
    } : {}),
    ...(query.categoryId ? { expenseCategoryId: query.categoryId } : {}),
    ...(query.from || query.to ? { expenseDate: { gte: new Date(query.from), lte: query.to ? new Date(query.to) : undefined } } : {}),
  };
  const [items, total, agg] = await Promise.all([
    prisma.expense.findMany({
      where, skip, take,
      orderBy: { expenseDate: "desc" },
      include: { expenseCategory: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);
  return {
    items: items.map(serializeExpense),
    meta: buildMeta({ page, limit }, total),
    summary: { totalAmount: agg._sum.amount?.toNumber() || 0 },
  };
}

async function getExpense(scope, id) {
  const e = await prisma.expense.findFirst({
    where: { id, businessId: scope.businessId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    include: { expenseCategory: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
  });
  if (!e) throw new ApiError(404, "Expense not found");
  return serializeExpense(e);
}

async function createExpense(user, data) {
  const scope = resolveWriteBranch(user, data);
  const category = await prisma.expenseCategory.findFirst({
    where: { id: data.expenseCategoryId, businessId: user.businessId },
  });
  if (!category) throw new ApiError(400, "Invalid expense category");
  const e = await prisma.expense.create({
    data: {
      businessId: user.businessId,
      branchId: scope.branchId,
      expenseCategoryId: data.expenseCategoryId,
      amount: String(data.amount),
      method: data.method,
      reference: data.reference || null,
      receiptUrl: data.receiptUrl || null,
      description: data.description || null,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
      createdById: user.id,
    },
    include: { expenseCategory: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
  });
  return serializeExpense(e);
}

async function updateExpense(scope, id, data) {
  const existing = await prisma.expense.findFirst({ where: { id, businessId: scope.businessId, ...(scope.branchId ? { branchId: scope.branchId } : {}) } });
  if (!existing) throw new ApiError(404, "Expense not found");
  if (data.expenseCategoryId) {
    const category = await prisma.expenseCategory.findFirst({
      where: { id: data.expenseCategoryId, businessId: scope.businessId },
    });
    if (!category) throw new ApiError(400, "Invalid expense category");
  }
  const e = await prisma.expense.update({
    where: { id },
    data: {
      ...data,
      amount: data.amount !== undefined ? String(data.amount) : undefined,
      reference: data.reference === undefined ? undefined : data.reference || null,
      receiptUrl: data.receiptUrl === undefined ? undefined : data.receiptUrl || null,
      description: data.description === undefined ? undefined : data.description || null,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
    },
    include: { expenseCategory: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
  });
  return serializeExpense(e);
}

async function deleteExpense(scope, id) {
  const existing = await prisma.expense.findFirst({ where: { id, businessId: scope.businessId, ...(scope.branchId ? { branchId: scope.branchId } : {}) } });
  if (!existing) throw new ApiError(404, "Expense not found");
  await prisma.expense.delete({ where: { id } });
}

module.exports = {
  listExpenseCategories,
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
};
