const { ApiError } = require("../utils/response");

/**
 * Branch access model:
 *  - OWNER / ADMIN / MANAGER can view & operate across ALL branches (consolidated).
 *  - EMPLOYEE / ACCOUNTANT are restricted to their assigned branch (user.branchId).
 *
 * For read/list endpoints `branchId` is the *filter* (null = all branches).
 * For write endpoints it is the *operating branch* and is forced for restricted
 * users (they cannot post to a branch they don't belong to).
 */

const VIEW_ALL_ROLES = ["OWNER", "ADMIN", "MANAGER"];

function canViewAll(user) {
  return VIEW_ALL_ROLES.includes(user.role);
}

/** Resolve the branch filter for a list/read request. */
function resolveReadScope(user, input = {}) {
  const businessId = user.businessId;
  if (canViewAll(user)) {
    const branchId = input.branchId || null;
    return { businessId, branchId, canViewAll: true, userBranchId: user.branchId || null };
  }
  return {
    businessId,
    branchId: user.branchId || null,
    canViewAll: false,
    userBranchId: user.branchId || null,
  };
}

/** Resolve the operating branch for a write (sale, purchase, stock move...). */
function resolveWriteBranch(user, input = {}) {
  const businessId = user.businessId;
  if (canViewAll(user)) {
    if (!input.branchId) throw new ApiError(400, "Select a branch before saving");
    return { businessId, branchId: input.branchId, canViewAll: true, userBranchId: user.branchId || null };
  }
  if (!user.branchId) throw new ApiError(400, "You are not assigned to a branch");
  return { businessId, branchId: user.branchId, canViewAll: false, userBranchId: user.branchId };
}

/** Prisma `where` fragment scoping a query to the resolved branch (if any). */
function branchWhere(scope) {
  return scope?.branchId ? { branchId: scope.branchId } : {};
}

module.exports = { resolveReadScope, resolveWriteBranch, branchWhere, canViewAll };
