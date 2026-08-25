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
    "branches:manage", "notifications:view", "search:use",
  ],
  MANAGER: [
    "dashboard:view", "products:view", "products:manage", "categories:view", "categories:manage",
    "inventory:view", "inventory:manage", "customers:view", "customers:manage",
    "suppliers:view", "suppliers:manage", "sales:view", "sales:create", "purchases:view",
    "purchases:create", "payments:view", "expenses:view", "invoices:view", "reports:view",
    "gst:view", "branches:manage", "notifications:view", "search:use",
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
  // Effective permissions from the server (custom roles) take precedence.
  if (Array.isArray(userPermissions)) {
    if (userPermissions.includes("*")) return true;
    return userPermissions.includes(permission);
  }
  const granted = PERMISSIONS[role] || [];
  if (granted.includes("*")) return true;
  return granted.includes(permission);
}

let userPermissions = null;

/** Called by AuthContext whenever the logged-in user's permissions are known. */
export function setUserPermissions(perms) {
  userPermissions = Array.isArray(perms) ? perms : null;
}

/** Grantable permissions for the role editor — mirrors backend catalog. */
export const ALL_PERMISSIONS = [
  { group: "General", items: [
    { key: "dashboard:view", label: "View dashboard" },
    { key: "search:use", label: "Use global search" },
    { key: "notifications:view", label: "Receive notifications" },
  ] },
  { group: "Catalog", items: [
    { key: "products:view", label: "View products" },
    { key: "products:manage", label: "Add / edit / delete products" },
    { key: "categories:view", label: "View categories" },
    { key: "categories:manage", label: "Manage categories" },
    { key: "inventory:view", label: "View inventory & stock" },
    { key: "inventory:manage", label: "Adjust / transfer stock" },
  ] },
  { group: "People", items: [
    { key: "customers:view", label: "View customers" },
    { key: "customers:manage", label: "Manage customers" },
    { key: "suppliers:view", label: "View suppliers" },
    { key: "suppliers:manage", label: "Manage suppliers" },
  ] },
  { group: "Business", items: [
    { key: "sales:view", label: "View sales" },
    { key: "sales:create", label: "Create sales" },
    { key: "purchases:view", label: "View purchases" },
    { key: "purchases:create", label: "Create purchases" },
    { key: "payments:view", label: "View payments" },
    { key: "payments:create", label: "Record payments" },
    { key: "expenses:view", label: "View expenses" },
    { key: "expenses:manage", label: "Manage expenses" },
    { key: "invoices:view", label: "View invoices" },
  ] },
  { group: "Insights", items: [
    { key: "reports:view", label: "View reports" },
    { key: "gst:view", label: "View GST summary" },
  ] },
  { group: "Administration", items: [
    { key: "users:manage", label: "View team members" },
    { key: "settings:manage", label: "Manage business settings" },
    { key: "roles:manage", label: "Manage custom roles" },
    { key: "branches:manage", label: "Manage branches & locations" },
  ] },
];
