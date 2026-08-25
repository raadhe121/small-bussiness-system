const party = require("../services/party.service");
const payment = require("../services/payment.service");
const { ok, created } = require("../utils/response");
const { resolveReadScope } = require("../utils/branchScope");

// ---- Customers ----

async function listCustomers(req, res, next) {
  try { ok(res, await party.listCustomers(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

async function getCustomer(req, res, next) {
  try { ok(res, await party.getCustomer(req.user.businessId, req.params.id)); }
  catch (err) { next(err); }
}

async function createCustomer(req, res, next) {
  try { created(res, await party.createCustomer(req.user.businessId, req.body), "Customer created successfully"); }
  catch (err) { next(err); }
}

async function updateCustomer(req, res, next) {
  try { ok(res, await party.updateCustomer(req.user.businessId, req.params.id, req.body), "Customer updated"); }
  catch (err) { next(err); }
}

async function deleteCustomer(req, res, next) {
  try { await party.deleteCustomer(req.user.businessId, req.params.id); ok(res, null, "Customer deleted"); }
  catch (err) { next(err); }
}

async function getCustomerLedger(req, res, next) {
  try { ok(res, await party.getCustomerLedger(req.user.businessId, req.params.id)); }
  catch (err) { next(err); }
}

// ---- Suppliers ----

async function listSuppliers(req, res, next) {
  try { ok(res, await party.listSuppliers(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

async function getSupplier(req, res, next) {
  try { ok(res, await party.getSupplier(req.user.businessId, req.params.id)); }
  catch (err) { next(err); }
}

async function createSupplier(req, res, next) {
  try { created(res, await party.createSupplier(req.user.businessId, req.body), "Supplier created successfully"); }
  catch (err) { next(err); }
}

async function updateSupplier(req, res, next) {
  try { ok(res, await party.updateSupplier(req.user.businessId, req.params.id, req.body), "Supplier updated"); }
  catch (err) { next(err); }
}

async function deleteSupplier(req, res, next) {
  try { await party.deleteSupplier(req.user.businessId, req.params.id); ok(res, null, "Supplier deleted"); }
  catch (err) { next(err); }
}

async function getSupplierLedger(req, res, next) {
  try { ok(res, await party.getSupplierLedger(req.user.businessId, req.params.id)); }
  catch (err) { next(err); }
}

// ---- Payments ----

async function listPayments(req, res, next) {
  try { ok(res, await payment.listPayments(resolveReadScope(req.user, req.query), req.query)); }
  catch (err) { next(err); }
}

async function createCustomerPayment(req, res, next) {
  try { created(res, await payment.createCustomerPayment(req.user, req.body), "Payment recorded"); }
  catch (err) { next(err); }
}

async function createSupplierPayment(req, res, next) {
  try { created(res, await payment.createSupplierPayment(req.user, req.body), "Payment recorded"); }
  catch (err) { next(err); }
}

module.exports = {
  listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerLedger,
  listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier, getSupplierLedger,
  listPayments, createCustomerPayment, createSupplierPayment,
};
