const expenseService = require("../services/expense.service");
const { ok, created } = require("../utils/response");

async function listExpenseCategories(req, res, next) {
  try { ok(res, await expenseService.listExpenseCategories(req.user.businessId)); }
  catch (err) { next(err); }
}

async function createExpenseCategory(req, res, next) {
  try { created(res, await expenseService.createExpenseCategory(req.user.businessId, req.body), "Expense category created"); }
  catch (err) { next(err); }
}

async function deleteExpenseCategory(req, res, next) {
  try { await expenseService.deleteExpenseCategory(req.user.businessId, req.params.id); ok(res, null, "Expense category deleted"); }
  catch (err) { next(err); }
}

async function listExpenses(req, res, next) {
  try { ok(res, await expenseService.listExpenses(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

async function getExpense(req, res, next) {
  try { ok(res, await expenseService.getExpense(req.user.businessId, req.params.id)); }
  catch (err) { next(err); }
}

async function createExpense(req, res, next) {
  try { created(res, await expenseService.createExpense(req.user, req.body), "Expense recorded"); }
  catch (err) { next(err); }
}

async function updateExpense(req, res, next) {
  try { ok(res, await expenseService.updateExpense(req.user.businessId, req.params.id, req.body), "Expense updated"); }
  catch (err) { next(err); }
}

async function deleteExpense(req, res, next) {
  try { await expenseService.deleteExpense(req.user.businessId, req.params.id); ok(res, null, "Expense deleted"); }
  catch (err) { next(err); }
}

module.exports = {
  listExpenseCategories, createExpenseCategory, deleteExpenseCategory,
  listExpenses, getExpense, createExpense, updateExpense, deleteExpense,
};
