const inventory = require("../services/inventory.service");
const { ok } = require("../utils/response");

async function listInventory(req, res, next) {
  try { ok(res, await inventory.listInventory(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

async function valuation(req, res, next) {
  try { ok(res, await inventory.stockValuation(req.user.businessId)); }
  catch (err) { next(err); }
}

async function listTransactions(req, res, next) {
  try { ok(res, await inventory.listTransactions(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

async function adjustStock(req, res, next) {
  try { ok(res, await inventory.adjustStock(req.user.businessId, req.user, req.body), "Stock updated"); }
  catch (err) { next(err); }
}

async function transferStock(req, res, next) {
  try { ok(res, await inventory.transferStock(req.user.businessId, req.user, req.body), "Stock transfer recorded"); }
  catch (err) { next(err); }
}

module.exports = { listInventory, valuation, listTransactions, adjustStock, transferStock };
