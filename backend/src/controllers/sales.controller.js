const salesService = require("../services/sales.service");
const { resolveReadScope, resolveWriteBranch } = require("../utils/branchScope");
const { ok, created } = require("../utils/response");

// ---- Sales ----

async function createSale(req, res, next) {
  try { created(res, await salesService.createSale(resolveWriteBranch(req.user, req.body), req.user, req.body), `Sale completed. Invoice ${req.body.invoiceNo ?? "created"}`); }
  catch (err) { next(err); }
}

async function listSales(req, res, next) {
  try { ok(res, await salesService.listSales(resolveReadScope(req.user, req.query), req.query)); }
  catch (err) { next(err); }
}

async function getSale(req, res, next) {
  try { ok(res, await salesService.getSale(resolveReadScope(req.user, req.query), req.params.id)); }
  catch (err) { next(err); }
}

async function createSaleReturn(req, res, next) {
  try { created(res, await salesService.createSaleReturn(resolveReadScope(req.user, req.query), req.user, req.params.id, req.body), "Sale return recorded"); }
  catch (err) { next(err); }
}

async function listReturns(req, res, next) {
  try { ok(res, await salesService.listReturns(resolveReadScope(req.user, req.query), req.query)); }
  catch (err) { next(err); }
}

// ---- Purchases ----

async function createPurchase(req, res, next) {
  try { created(res, await salesService.createPurchase(resolveWriteBranch(req.user, req.body), req.user, req.body), "Purchase recorded successfully"); }
  catch (err) { next(err); }
}

async function listPurchases(req, res, next) {
  try { ok(res, await salesService.listPurchases(resolveReadScope(req.user, req.query), req.query)); }
  catch (err) { next(err); }
}

async function getPurchase(req, res, next) {
  try { ok(res, await salesService.getPurchase(resolveReadScope(req.user, req.query), req.params.id)); }
  catch (err) { next(err); }
}

module.exports = {
  createSale, listSales, getSale, createSaleReturn, listReturns,
  createPurchase, listPurchases, getPurchase,
};
