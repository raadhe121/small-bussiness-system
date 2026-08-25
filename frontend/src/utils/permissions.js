/**
 * Front-end mirror of the backend permission matrix
 * (backend/src/config/permissions.js). Used for hiding UI the role cannot use.
 */
const PERMISSIONS = {
  OWNER: ["*"],
  ADMIN: [
    "dashboard:view", "products:view", "products:manage", "categories:view", "categories:manage",
    "inventory:view", "inventory:manage", "customers:view", "customers:manage",
    "suppliers:view", "suppliers:manage", "sales:view", "sales:create", "purchases:view",
    "purchases:create", "payments:view", "payments:create", "expenses:view", "expenses:manage",
    "invoices:view", "reports:view", "gst:view", "users:manage", "settings:manage",
    "notifications:view", "search:use",
  ],
  MANAGER: [
    "dashboard:view", "products:view", "products:manage", "categories:view", "categories:manage",
    "inventory:view", "inventory:manage", "customers:view", "customers:manage",
    "suppliers:view", "suppliers:manage", "sales:view", "sales:create", "purchases:view",
    "purchases:create", "payments:view", "expenses:view", "invoices:view", "reports:view",
    "gst:view", "notifications:view", "search:use",
  ],
  ACCOUNTANT: [
    "dashboard:view", "products:view", "categories:view", "inventory:view", "customers:view",
    "suppliers:view", "sales:view", "purchases:view", "payments:view", "payments:create",
    "expenses:view", "expenses:manage", "invoices:view", "reports:view", "gst:view",
    "notifications:view", "search:use",
  ],
  EMPLOYEE: [
    "dashboard:view", "products:view", "categories:view", "inventory:view", "customers:view",
    "customers:manage", "sales:view", "sales:create", "invoices:view", "notifications:view",
    "search:use",
  ],
};

export function hasPermission(role, permission) {
  const granted = PERMISSIONS[role] || [];
  if (granted.includes("*")) return true;
  return granted.includes(permission);
}
