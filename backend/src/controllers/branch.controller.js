const branchService = require("../services/branch.service");
const { ok, created, noContent } = require("../utils/response");

async function listBranches(req, res, next) {
  try { ok(res, await branchService.listBranches(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

async function getBranch(req, res, next) {
  try { ok(res, await branchService.getBranch(req.user.businessId, req.params.id)); }
  catch (err) { next(err); }
}

async function createBranch(req, res, next) {
  try { created(res, await branchService.createBranch(req.user.businessId, req.body), "Branch created"); }
  catch (err) { next(err); }
}

async function updateBranch(req, res, next) {
  try { ok(res, await branchService.updateBranch(req.user.businessId, req.params.id, req.body)); }
  catch (err) { next(err); }
}

async function deleteBranch(req, res, next) {
  try { await branchService.deleteBranch(req.user.businessId, req.params.id); noContent(res); }
  catch (err) { next(err); }
}

module.exports = { listBranches, getBranch, createBranch, updateBranch, deleteBranch };
