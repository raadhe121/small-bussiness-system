const { ApiError } = require("../utils/response");
const { verifyToken } = require("../utils/jwt");
const prisma = require("../config/prisma");

/**
 * Verifies the JWT (Authorization: Bearer <token>) and loads the user.
 * Attaches req.user with tenant info. Rejects users without a business
 * except on onboarding/auth routes handled by the caller.
 */
async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new ApiError(401, "Authentication required");

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new ApiError(401, "Invalid or expired token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        business: { select: { id: true, name: true, currency: true, invoicePrefix: true, state: true, logoUrl: true } },
        customRole: true,
      },
    });
    if (!user || !user.isActive) throw new ApiError(401, "Account is disabled or no longer exists");

    const { resolvePermissions } = require("../config/permissions");
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isPlatformAdmin: !!user.isPlatformAdmin,
      permissions: resolvePermissions(user),
      businessId: user.businessId,
      business: user.business,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Ensures the authenticated user belongs to a tenant (business). */
function requireBusiness(req, _res, next) {
  if (!req.user?.businessId) {
    return next(new ApiError(403, "Complete business onboarding to access this resource"));
  }
  next();
}

module.exports = { authenticate, requireBusiness };
