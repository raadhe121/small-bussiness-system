const platformService = require("../services/platform.service");
const { ok } = require("../utils/response");
const { asyncHandler } = require("../utils/asyncHandler");

exports.overview = asyncHandler(async (req, res) => {
  ok(res, await platformService.getOverview(), "Platform overview");
});

exports.listBusinesses = asyncHandler(async (req, res) => {
  const data = await platformService.listBusinesses(req.query);
  ok(res, data, "Businesses");
});

exports.getBusiness = asyncHandler(async (req, res) => {
  ok(res, await platformService.getBusinessDetail(req.params.id), "Business detail");
});

exports.updateBusiness = asyncHandler(async (req, res) => {
  ok(res, await platformService.updateBusiness(req.params.id, req.body), "Business updated");
});

exports.deleteBusiness = asyncHandler(async (req, res) => {
  ok(res, await platformService.deleteBusiness(req.params.id), "Business and all its data deleted");
});

exports.listUsers = asyncHandler(async (req, res) => {
  ok(res, await platformService.listUsers(req.query), "Users");
});

exports.createUser = asyncHandler(async (req, res) => {
  const user = await platformService.createUser(req.user, req.body);
  ok(res, user, "User created");
});

exports.setUserStatus = asyncHandler(async (req, res) => {
  ok(res, await platformService.setUserStatus(req.user, req.params.id, req.body.isActive), "User status updated");
});

exports.changeUserRole = asyncHandler(async (req, res) => {
  ok(res, await platformService.changeUserRole(req.user, req.params.id, req.body.role), "User role updated");
});

exports.updateUser = asyncHandler(async (req, res) => {
  if (req.body.role !== undefined) return exports.changeUserRole(req, res);
  return exports.setUserStatus(req, res);
});

exports.deleteUser = asyncHandler(async (req, res) => {
  ok(res, await platformService.deleteUser(req.user, req.params.id), "User deleted");
});
