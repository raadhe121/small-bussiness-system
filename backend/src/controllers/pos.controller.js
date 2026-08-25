const posService = require("../services/pos.service");
const { ok, created } = require("../utils/response");

async function holdBill(req, res, next) {
  try { created(res, await posService.holdBill(req.user, req.body), "Bill held aside"); }
  catch (err) { next(err); }
}

async function listHeldBills(req, res, next) {
  try { ok(res, await posService.listHeldBills(req.user.businessId)); }
  catch (err) { next(err); }
}

async function getHeldBill(req, res, next) {
  try { ok(res, await posService.getHeldBill(req.user.businessId, req.params.id)); }
  catch (err) { next(err); }
}

async function deleteHeldBill(req, res, next) {
  try { ok(res, await posService.deleteHeldBill(req.user.businessId, req.params.id)); }
  catch (err) { next(err); }
}

module.exports = { holdBill, listHeldBills, getHeldBill, deleteHeldBill };
