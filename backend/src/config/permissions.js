/**
 * Role-based permission matrix.
 * A permission is "resource:action". "*" grants everything.
 */
const PERMISSIONS = {
  OWNER: ["*"],
  ADMIN: [
    "dashboard:view",
    "products:view", "products:manage",
    "categories:view", "categories:manage",
    "inventory:view", "inventory:manage",
    "customers:view", "customers:manage",
    "suppliers:view", "suppliers:manage",
    "sales:view", "sales:create", "sales:manage",
    "purchases:view", "purchases:create", "purchases:manage",
    "payments:view", "payments:create", "payments:manage",
    "expenses:view", "expenses:manage",
    "invoices:view",
    "reports:view", "gst:view",
    "users:manage", "settings:manage",
    "notifications:view", "search:use",
  ],
  MANAGER: [
    "dashboard:view",
    "products:view", "products:manage",
    "categories:view", "categories:manage",
    "inventory:view", "inventory:manage",
    "customers:view", "customers:manage",
    "suppliers:view", "suppliers:manage",
    "sales:view", "sales:create",
    "purchases:view", "purchases:create",
    "payments:view",
    "expenses:view",
    "invoices:view",
    "reports:view", "gst:view",
    "notifications:view", "search:use",
  ],
  ACCOUNTANT: [
    "dashboard:view",
    "products:view", "categories:view", "inventory:view",
    "customers:view", "suppliers:view",
    "sales:view", "purchases:view",
    "payments:view", "payments:create",
    "expenses:view", "expenses:manage",
    "invoices:view",
    "reports:view", "gst:view",
    "notifications:view", "search:use",
  ],
  EMPLOYEE: [
    "dashboard:view",
    "products:view", "categories:view", "inventory:view",
    "customers:view", "customers:manage",
    "sales:view", "sales:create",
    "invoices:view",
    "notifications:view", "search:use",
  ],
};

function hasPermission(role, permission) {
  const granted = PERMISSIONS[role] || [];
  if (granted.includes("*")) return true;
  return granted.includes(permission);
}

/** Catalog of every grantable permission, grouped for the role editor UI. */
const ALL_PERMISSIONS = [
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
    { key: "sales:manage", label: "Delete sales & invoices" },
    { key: "purchases:view", label: "View purchases" },
    { key: "purchases:create", label: "Create purchases" },
    { key: "purchases:manage", label: "Delete purchases" },
    { key: "payments:view", label: "View payments" },
    { key: "payments:create", label: "Record payments" },
    { key: "payments:manage", label: "Delete payments" },
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
    { key: "roles:manage", label: "Manage custom roles (owner area)" },
  ] },
];

const ALL_PERMISSION_KEYS = ALL_PERMISSIONS.flatMap((g) => g.items.map((i) => i.key));

/**
 * Resolves a user's effective permission list.
 * A custom role replaces the built-in matrix entirely; OWNER always gets "*".
 */
function resolvePermissions(user) {
  if (user.role === "OWNER") return ["*"];
  if (user.customRole && Array.isArray(user.customRole.permissions)) {
    // Always keep baseline access so the app is usable.
    return Array.from(new Set([
      "dashboard:view", "notifications:view", "search:use",
      ...user.customRole.permissions.filter((p) => ALL_PERMISSION_KEYS.includes(p)),
    ]));
  }
  return PERMISSIONS[user.role] || [];
}

module.exports = { PERMISSIONS, hasPermission, ALL_PERMISSIONS, resolvePermissions };
