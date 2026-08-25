const salesService = require("../services/sales.service");
const { ok, created } = require("../utils/response");

// ---- Sales ----

async function createSale(req, res, next) {
  try { created(res, await salesService.createSale(req.user, req.body), `Sale completed. Invoice ${req.body.invoiceNo ?? "created"}`); }
  catch (err) { next(err); }
}

async function listSales(req, res, next) {
  try { ok(res, await salesService.listSales(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

async function getSale(req, res, next) {
  try { ok(res, await salesService.getSale(req.user.businessId, req.params.id)); }
  catch (err) { next(err); }
}

async function createSaleReturn(req, res, next) {
  try { created(res, await salesService.createSaleReturn(req.user, req.params.id, req.body), "Sale return recorded"); }
  catch (err) { next(err); }
}

async function listReturns(req, res, next) {
  try { ok(res, await salesService.listReturns(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

// ---- Purchases ----

async function createPurchase(req, res, next) {
  try { created(res, await salesService.createPurchase(req.user, req.body), "Purchase recorded successfully"); }
  catch (err) { next(err); }
}

async function listPurchases(req, res, next) {
  try { ok(res, await salesService.listPurchases(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

async function getPurchase(req, res, next) {
  try { ok(res, await salesService.getPurchase(req.user.businessId, req.params.id)); }
  catch (err) { next(err); }
}

module.exports = {
  createSale, listSales, getSale, createSaleReturn, listReturns,
  createPurchase, listPurchases, getPurchase,
};
