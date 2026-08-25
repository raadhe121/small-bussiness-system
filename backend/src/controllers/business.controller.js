const businessService = require("../services/business.service");
const { ok, created } = require("../utils/response");

// ---- Business / onboarding ----

async function createBusiness(req, res, next) {
  try {
    const result = await businessService.createBusiness(req.user, req.body);
    created(res, result, "Business created successfully");
  } catch (err) { next(err); }
}

async function getBusiness(req, res, next) {
  try {
    ok(res, await businessService.getBusiness(req.user.businessId));
  } catch (err) { next(err); }
}

async function updateBusiness(req, res, next) {
  try {
    ok(res, await businessService.updateSettings(req.user.businessId, req.body), "Settings updated");
  } catch (err) { next(err); }
}

// ---- Users ----

async function listUsers(req, res, next) {
  try {
    ok(res, await businessService.listUsers(req.user.businessId));
  } catch (err) { next(err); }
}

async function createUser(req, res, next) {
  try {
    const user = await businessService.createUser(req.user.businessId, req.body);
    created(res, user, "Team member added");
  } catch (err) { next(err); }
}

async function updateUser(req, res, next) {
  try {
    const user = await businessService.updateUser(req.user, req.params.id, req.body);
    ok(res, user, "Team member updated");
  } catch (err) { next(err); }
}

async function getUserActivity(req, res, next) {
  try {
    ok(res, await businessService.getUserActivity(req.user.businessId, req.params.id));
  } catch (err) { next(err); }
}

module.exports = { createBusiness, getBusiness, updateBusiness, listUsers, createUser, updateUser, getUserActivity };
