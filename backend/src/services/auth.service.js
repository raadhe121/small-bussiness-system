const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { signToken } = require("../utils/jwt");

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  isPlatformAdmin: !!u.isPlatformAdmin,
  customRole: u.customRole ? { id: u.customRole.id, name: u.customRole.name } : null,
  permissions: u.permissions || null,
  isActive: u.isActive,
  businessId: u.businessId,
  branchId: u.branchId ?? null,
  business: u.business
    ? {
        id: u.business.id,
        name: u.business.name,
        currency: u.business.currency,
        invoicePrefix: u.business.invoicePrefix,
        logoUrl: u.business.logoUrl,
      }
    : null,
  lastLoginAt: u.lastLoginAt,
});

/** Attaches the effective permission list to a user object. */
function withPermissions(user) {
  const { resolvePermissions } = require("../config/permissions");
  return { ...user, permissions: resolvePermissions(user) };
}

async function register({ name, email, phone, password }) {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new ApiError(409, "An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
      role: "OWNER", // provisional; becomes the owner once a business is created
    },
  });

  return { token: issueToken(user), user: publicUser(user) };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      business: { select: { id: true, name: true, currency: true, invoicePrefix: true, state: true, logoUrl: true } },
      customRole: true,
    },
  });
  if (!user) throw new ApiError(401, "Invalid email or password");
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid email or password");
  if (!user.isActive) throw new ApiError(403, "Your account has been disabled");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { token: issueToken(user), user: publicUser(withPermissions(user)) };
}

function issueToken(user) {
  return signToken({ sub: user.id, role: user.role, businessId: user.businessId || null });
}

/**
 * Forgot password: generates a single-use token and returns it.
 * In production this token would be emailed via an SMTP/SMS provider —
 * see README "Email integration" for wiring SendGrid/SES credentials.
 */
async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Do not reveal whether the account exists.
  if (!user) return { sent: true };
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenHash: hash, resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });
  return { sent: true, ...(process.env.NODE_ENV !== "production" ? { devToken: raw } : {}) };
}

async function resetPassword({ token, password }) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await prisma.user.findFirst({
    where: { resetTokenHash: hash, resetTokenExpiry: { gt: new Date() } },
  });
  if (!user) throw new ApiError(400, "Reset link is invalid or has expired");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
      resetTokenHash: null,
      resetTokenExpiry: null,
    },
  });
  return true;
}

async function changePassword(user, { currentPassword, newPassword }) {
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  const valid = await bcrypt.compare(currentPassword, record.passwordHash);
  if (!valid) throw new ApiError(400, "Current password is incorrect");
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS) },
  });
}

async function updateProfile(user, data) {
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.phone ? { phone: data.phone } : {}),
    },
    include: { business: { select: { id: true, name: true, currency: true, invoicePrefix: true, logoUrl: true } } },
  });
  return publicUser(updated);
}

module.exports = {
  register,
  login,
  issueToken,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  publicUser,
  withPermissions,
};
