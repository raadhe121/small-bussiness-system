const { ApiError } = require("../utils/response");

/** authorize("products", "manage") -> requires "products:manage" */
function authorize(resource, action) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, "Authentication required"));
    const needed = `${resource}:${action}`;
    // Effective permissions (custom roles) take precedence over the static matrix.
    const granted = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : (() => {
          const { hasPermission } = require("../config/permissions");
          return hasPermission(req.user.role, needed) ? ["*"] : [];
        })();
    if (!granted.includes("*") && !granted.includes(needed)) {
      return next(new ApiError(403, `Your role does not allow this action`));
    }
    next();
  };
}

/** Restricts a route to the business OWNER only. */
function requireOwner(req, _res, next) {
  if (!req.user) return next(new ApiError(401, "Authentication required"));
  if (req.user.role !== "OWNER") {
    return next(new ApiError(403, "Only the business owner can perform this action"));
  }
  next();
}

/** Restricts a route to users who can manage across branches (owner/admin/manager). */
function requireManager(req, _res, next) {
  if (!req.user) return next(new ApiError(401, "Authentication required"));
  if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) {
    return next(new ApiError(403, "Only owners, admins or managers can manage branches"));
  }
  next();
}

/** Restricts a route to platform administrators (the DukaanSetu back-office). */
function requirePlatformAdmin(req, _res, next) {
  if (!req.user) return next(new ApiError(401, "Authentication required"));
  if (!req.user.isPlatformAdmin) {
    return next(new ApiError(403, "Platform administrator access required"));
  }
  next();
}

module.exports = { authorize, requireOwner, requireManager, requirePlatformAdmin };
