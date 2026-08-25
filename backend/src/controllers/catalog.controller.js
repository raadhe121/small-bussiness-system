const catalog = require("../services/catalog.service");
const { ok, created } = require("../utils/response");

// ---- Categories ----

async function listCategories(req, res, next) {
  try { ok(res, await catalog.listCategories(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

async function createCategory(req, res, next) {
  try { created(res, await catalog.createCategory(req.user.businessId, req.body), "Category created successfully"); }
  catch (err) { next(err); }
}

async function updateCategory(req, res, next) {
  try { ok(res, await catalog.updateCategory(req.user.businessId, req.params.id, req.body), "Category updated"); }
  catch (err) { next(err); }
}

async function deleteCategory(req, res, next) {
  try { await catalog.deleteCategory(req.user.businessId, req.params.id); ok(res, null, "Category deleted"); }
  catch (err) { next(err); }
}

// ---- Products ----

async function listProducts(req, res, next) {
  try { ok(res, await catalog.listProducts(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

async function getProduct(req, res, next) {
  try { ok(res, await catalog.getProduct(req.user.businessId, req.params.id)); }
  catch (err) { next(err); }
}

async function getProductByBarcode(req, res, next) {
  try { ok(res, await catalog.getProductByBarcode(req.user.businessId, req.params.code)); }
  catch (err) { next(err); }
}

async function createProduct(req, res, next) {
  try { created(res, await catalog.createProduct(req.user.businessId, req.user.id, req.body), "Product created successfully"); }
  catch (err) { next(err); }
}

async function updateProduct(req, res, next) {
  try { ok(res, await catalog.updateProduct(req.user.businessId, req.params.id, req.body), "Product updated"); }
  catch (err) { next(err); }
}

async function deleteProduct(req, res, next) {
  try { await catalog.deleteProduct(req.user.businessId, req.params.id); ok(res, null, "Product deleted"); }
  catch (err) { next(err); }
}

module.exports = {
  listCategories, createCategory, updateCategory, deleteCategory,
  listProducts, getProduct, getProductByBarcode, createProduct, updateProduct, deleteProduct,
};
