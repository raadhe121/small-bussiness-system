const { ApiError } = require("../utils/response");
const { hasPermission } = require("../config/permissions");

/** authorize("products", "manage") -> requires "products:manage" */
function authorize(resource, action) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, "Authentication required"));
    if (!hasPermission(req.user.role, `${resource}:${action}`)) {
      return next(new ApiError(403, `Your role (${req.user.role}) does not allow this action`));
    }
    next();
  };
}

module.exports = { authorize };
