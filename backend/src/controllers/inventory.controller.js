const inventory = require("../services/inventory.service");
const { resolveReadScope, resolveWriteBranch } = require("../utils/branchScope");
const { ok } = require("../utils/response");

async function listInventory(req, res, next) {
  try { ok(res, await inventory.listInventory(resolveReadScope(req.user, req.query), req.query)); }
  catch (err) { next(err); }
}

async function valuation(req, res, next) {
  try { ok(res, await inventory.stockValuation(resolveReadScope(req.user, req.query))); }
  catch (err) { next(err); }
}

async function listTransactions(req, res, next) {
  try { ok(res, await inventory.listTransactions(resolveReadScope(req.user, req.query), req.query)); }
  catch (err) { next(err); }
}

async function adjustStock(req, res, next) {
  try { ok(res, await inventory.adjustStock(resolveWriteBranch(req.user, req.body), req.user, req.body), "Stock updated"); }
  catch (err) { next(err); }
}

async function transferStock(req, res, next) {
  try { ok(res, await inventory.transferStock({ businessId: req.user.businessId, branchId: null }, req.user, req.body), "Stock transfer recorded"); }
  catch (err) { next(err); }
}

module.exports = { listInventory, valuation, listTransactions, adjustStock, transferStock };
