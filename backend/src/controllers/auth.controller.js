const authService = require("../services/auth.service");
const { ok, created } = require("../utils/response");

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    created(res, result, "Account registered successfully. Create your business to continue.");
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    ok(res, result, "Login successful");
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    const user = await authService.publicUser(
      await require("../config/prisma").user.findUnique({
        where: { id: req.user.id },
        include: { business: { select: { id: true, name: true, currency: true, invoicePrefix: true, state: true, logoUrl: true } } },
      })
    );
    ok(res, user);
  } catch (err) { next(err); }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword(req.body.email);
    ok(res, result, "If that email exists, a reset link has been generated");
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.body);
    ok(res, null, "Password reset successfully. You can now log in.");
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.user, req.body);
    ok(res, null, "Password changed successfully");
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const user = await authService.updateProfile(req.user, req.body);
    ok(res, user, "Profile updated");
  } catch (err) { next(err); }
}

module.exports = { register, login, me, forgotPassword, resetPassword, changePassword, updateProfile };
