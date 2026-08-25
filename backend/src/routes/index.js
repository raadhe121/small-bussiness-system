const { Router } = require("express");
const { authenticate, requireBusiness } = require("../middleware/authenticate");
const { authorize, requireOwner, requirePlatformAdmin, requireManager } = require("../middleware/authorize");
const { validate } = require("../middleware/validate");
const z = require("zod");

// schemas
const authV = require("../validations/auth.schema");
const bizV = require("../validations/business.schema");
const catV = require("../validations/catalog.schema");
const branchV = require("../validations/branch.schema");
const txnV = require("../validations/transaction.schema");
const dateV = require("../validations/dateRange.schema");

// controllers
const authC = require("../controllers/auth.controller");
const bizC = require("../controllers/business.controller");
const catC = require("../controllers/catalog.controller");
const invC = require("../controllers/inventory.controller");
const partyC = require("../controllers/party.controller");
const salesC = require("../controllers/sales.controller");
const posC = require("../controllers/pos.controller");
const expC = require("../controllers/expense.controller");
const analyticsC = require("../controllers/analytics.controller");
const roleC = require("../controllers/role.controller");
const platformC = require("../controllers/platform.controller");
const branchC = require("../controllers/branch.controller");

// UUID param validator
const idParam = validate({ params: z.object({ id: z.string().uuid() }) });

/** Wraps a route with authentication + tenant requirement. */
const guard = [authenticate, requireBusiness];

module.exports = function apiRouter() {
  const router = Router();

  // ---- Health ----
  router.get("/health", (_req, res) =>
    res.json({ success: true, message: "DukaanSetu API is healthy", data: { uptime: process.uptime(), timestamp: new Date().toISOString() } })
  );

  // ---- Auth (no business required yet) ----
  const auth = Router();
  auth.post("/register", validate({ body: authV.registerSchema }), authC.register);
  auth.post("/login", validate({ body: authV.loginSchema }), authC.login);
  auth.post("/forgot-password", validate({ body: authV.forgotPasswordSchema }), authC.forgotPassword);
  auth.post("/reset-password", validate({ body: authV.resetPasswordSchema }), authC.resetPassword);
  auth.get("/me", authenticate, authC.me);
  auth.put("/profile", guard, validate({ body: authV.updateProfileSchema }), authC.updateProfile);
  auth.put("/change-password", guard, validate({ body: authV.changePasswordSchema }), authC.changePassword);
  router.use("/auth", auth);

  // ---- Business onboarding (authenticated users WITHOUT a business) ----
  router.use(authenticate);
  router.post("/business", validate({ body: bizV.businessSchema }), bizC.createBusiness);

  // ---- Platform admin panel (cross-tenant back-office, no tenant required) ----
  const platform = Router();
  platform.use(requirePlatformAdmin);
  platform.get("/overview", platformC.overview);
  const pBizBody = z.object({
    name: z.string().trim().min(2).max(160).optional(),
    ownerName: z.string().trim().min(2).max(160).optional(),
    phone: z.string().trim().min(6).max(20).optional(),
    email: z.string().trim().email().or(z.literal("")).optional(),
    gstin: z.string().trim().max(15).optional(),
    isActive: z.boolean().optional(),
  });
  platform.get("/businesses", platformC.listBusinesses);
  platform.get("/businesses/:id", idParam, platformC.getBusiness);
  platform.put("/businesses/:id", idParam, validate({ body: pBizBody }), platformC.updateBusiness);
  platform.delete("/businesses/:id", idParam, platformC.deleteBusiness);
  const pUserBody = z.object({
    isActive: z.boolean().optional(),
    role: z.enum(["OWNER", "ADMIN", "MANAGER", "EMPLOYEE", "ACCOUNTANT"]).optional(),
  });
  platform.get("/users", platformC.listUsers);
  platform.put("/users/:id", idParam, validate({ body: pUserBody }), platformC.updateUser);
  platform.delete("/users/:id", idParam, platformC.deleteUser);
  router.use("/platform", platform);

  // Everything below requires a business tenant.
  router.use(requireBusiness);

  // ---- Business & users ----
  const business = Router();
  business.get("/", bizC.getBusiness);
  business.put("/settings", authorize("settings", "manage"), validate({ body: bizV.businessUpdateSchema }), bizC.updateBusiness);

  const users = Router();
  users.get("/", authorize("users", "manage"), bizC.listUsers);
  users.post("/", authorize("users", "manage"), validate({ body: bizV.userCreateSchema }), bizC.createUser);
  users.put("/:id", authorize("users", "manage"), idParam, validate({ body: bizV.userUpdateSchema }), bizC.updateUser);
  users.get("/:id/activity", authorize("users", "manage"), idParam, bizC.getUserActivity);
  router.use("/users", users);

  router.use("/business", business);
  router.use("/users", users);

  // ---- Roles & permissions (view: users:manage · edit/delete: OWNER only) ----
  const roleBody = z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(255).optional(),
    permissions: z.array(z.string()).min(1, "Select at least one permission"),
  });
  const roles = Router();
  roles.get("/", authorize("users", "manage"), roleC.listRoles);
  roles.get("/catalog", authenticate, requireBusiness, roleC.permissionCatalog);
  roles.post("/", requireOwner, validate({ body: roleBody }), roleC.createRole);
  roles.put("/:id", requireOwner, idParam, validate({ body: roleBody.partial() }), roleC.updateRole);
  roles.delete("/:id", requireOwner, idParam, roleC.deleteRole);
  router.use("/roles", roles);

  // ---- Branches (multi-location under one business) ----
  const branches = Router();
  branches.get("/", requireManager, branchC.listBranches);
  branches.get("/:id", requireManager, idParam, branchC.getBranch);
  branches.post("/", requireManager, validate({ body: branchV.branchSchema }), branchC.createBranch);
  branches.put("/:id", requireManager, idParam, validate({ body: branchV.branchUpdateSchema }), branchC.updateBranch);
  branches.delete("/:id", requireManager, idParam, branchC.deleteBranch);
  router.use("/branches", branches);

  // ---- Categories ----
  router.get("/categories", authorize("categories", "view"), catC.listCategories);
  router.post("/categories", authorize("categories", "manage"), validate({ body: catV.categorySchema }), catC.createCategory);
  router.put("/categories/:id", authorize("categories", "manage"), idParam, validate({ body: catV.categoryUpdateSchema }), catC.updateCategory);
  router.delete("/categories/:id", authorize("categories", "manage"), idParam, catC.deleteCategory);

  // ---- Products ----
  router.get("/products", authorize("products", "view"), validate({ query: catV.productQuerySchema }), catC.listProducts);
  router.get("/products/barcode/:code", authorize("products", "view"), catC.getProductByBarcode);
  router.get("/products/:id", authorize("products", "view"), idParam, catC.getProduct);
  router.post("/products", authorize("products", "manage"), validate({ body: catV.productSchema }), catC.createProduct);
  router.put("/products/:id", authorize("products", "manage"), idParam, validate({ body: catV.productUpdateSchema }), catC.updateProduct);
  router.delete("/products/:id", authorize("products", "manage"), idParam, catC.deleteProduct);

  // ---- Inventory ----
  router.get("/inventory", authorize("inventory", "view"), validate({ query: txnV.inventoryQuerySchema }), invC.listInventory);
  router.get("/inventory/valuation", authorize("inventory", "view"), invC.valuation);
  router.get("/inventory/transactions", authorize("inventory", "view"), validate({ query: txnV.txnQuerySchema }), invC.listTransactions);
  router.post("/inventory/adjust", authorize("inventory", "manage"), validate({ body: txnV.stockAdjustSchema }), invC.adjustStock);
  router.post("/inventory/transfer", authorize("inventory", "manage"), validate({ body: txnV.transferSchema }), invC.transferStock);

  // ---- Customers ----
  router.get("/customers", authorize("customers", "view"), validate({ query: catV.listQuery }), partyC.listCustomers);
  router.get("/customers/:id/ledger", authorize("customers", "view"), idParam, partyC.getCustomerLedger);
  router.get("/customers/:id", authorize("customers", "view"), idParam, partyC.getCustomer);
  router.post("/customers", authorize("customers", "manage"), validate({ body: catV.customerSchema }), partyC.createCustomer);
  router.put("/customers/:id", authorize("customers", "manage"), idParam, validate({ body: catV.customerUpdateSchema }), partyC.updateCustomer);
  router.delete("/customers/:id", authorize("customers", "manage"), idParam, partyC.deleteCustomer);

  // ---- Suppliers ----
  router.get("/suppliers", authorize("suppliers", "view"), validate({ query: catV.listQuery }), partyC.listSuppliers);
  router.get("/suppliers/:id/ledger", authorize("suppliers", "view"), idParam, partyC.getSupplierLedger);
  router.get("/suppliers/:id", authorize("suppliers", "view"), idParam, partyC.getSupplier);
  router.post("/suppliers", authorize("suppliers", "manage"), validate({ body: catV.supplierSchema }), partyC.createSupplier);
  router.put("/suppliers/:id", authorize("suppliers", "manage"), idParam, validate({ body: catV.supplierUpdateSchema }), partyC.updateSupplier);
  router.delete("/suppliers/:id", authorize("suppliers", "manage"), idParam, partyC.deleteSupplier);

  // ---- Sales / Purchases ----
  const saleQuery = validate({
    query: catV.listQuery.extend({
      customerId: z.string().uuid().optional(),
      from: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
      to: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    }),
  });
  router.get("/sales", authorize("sales", "view"), saleQuery, salesC.listSales);
  router.get("/sales/:id", authorize("sales", "view"), idParam, salesC.getSale);
  router.post("/sales", authorize("sales", "create"), validate({ body: txnV.saleSchema }), salesC.createSale);
  router.post("/sales/:id/return", authorize("sales", "create"), idParam, validate({ body: txnV.saleReturnSchema }), salesC.createSaleReturn);
  router.get("/returns", authorize("sales", "view"), saleQuery, salesC.listReturns);

  // ---- POS (hold / resume parked bills) ----
  const pos = Router();
  pos.post("/hold", authorize("sales", "create"), validate({ body: txnV.holdBillSchema }), posC.holdBill);
  pos.get("/hold", authorize("sales", "create"), posC.listHeldBills);
  pos.get("/hold/:id", authorize("sales", "create"), idParam, posC.getHeldBill);
  pos.delete("/hold/:id", authorize("sales", "create"), idParam, posC.deleteHeldBill);
  router.use("/pos", pos);
  router.get("/purchases", authorize("purchases", "view"), saleQuery, salesC.listPurchases);
  router.get("/purchases/:id", authorize("purchases", "view"), idParam, salesC.getPurchase);
  router.post("/purchases", authorize("purchases", "create"), validate({ body: txnV.purchaseSchema }), salesC.createPurchase);

  // ---- Payments ----
  router.get("/payments", authorize("payments", "view"), saleQuery, partyC.listPayments);
  router.post("/payments/customer", authorize("payments", "create"), validate({ body: catV.customerPaymentSchema }), partyC.createCustomerPayment);
  router.post("/payments/supplier", authorize("payments", "create"), validate({ body: catV.supplierPaymentSchema }), partyC.createSupplierPayment);

  // ---- Expenses ----
  router.get("/expenses/categories", authorize("expenses", "view"), expC.listExpenseCategories);
  router.post("/expenses/categories", authorize("expenses", "manage"), validate({ body: txnV.expenseCategorySchema }), expC.createExpenseCategory);
  router.delete("/expenses/categories/:id", authorize("expenses", "manage"), idParam, expC.deleteExpenseCategory);
  router.get("/expenses", authorize("expenses", "view"), saleQuery, expC.listExpenses);
  router.get("/expenses/:id", authorize("expenses", "view"), idParam, expC.getExpense);
  router.post("/expenses", authorize("expenses", "manage"), validate({ body: txnV.expenseSchema }), expC.createExpense);
  router.put("/expenses/:id", authorize("expenses", "manage"), idParam, validate({ body: txnV.expenseUpdateSchema }), expC.updateExpense);
  router.delete("/expenses/:id", authorize("expenses", "manage"), idParam, expC.deleteExpense);

  // ---- Invoices ----
  router.get("/invoices/:saleId", authorize("invoices", "view"),
    validate({ params: z.object({ saleId: z.string().uuid() }) }),
    analyticsC.getInvoiceData);

  // ---- Reports / GST ----
  router.get("/reports/dashboard", authorize("dashboard", "view"), analyticsC.dashboard);
  router.get("/reports/sales", authorize("reports", "view"), validate({ query: dateV.dateRangeSchema }), analyticsC.salesReport);
  router.get("/reports/purchases", authorize("reports", "view"), validate({ query: dateV.dateRangeSchema }), analyticsC.purchaseReport);
  router.get("/reports/profit", authorize("reports", "view"), validate({ query: dateV.dateRangeSchema }), analyticsC.profitReport);
  router.get("/reports/expenses", authorize("reports", "view"), validate({ query: dateV.dateRangeSchema }), analyticsC.expenseReport);
  router.get("/reports/inventory", authorize("reports", "view"), analyticsC.inventoryReport);
  router.get("/reports/outstanding", authorize("reports", "view"), analyticsC.outstandingReport);
  router.get("/reports/payments", authorize("reports", "view"), validate({ query: dateV.dateRangeSchema }), analyticsC.paymentReport);
  router.get("/gst/summary", authorize("gst", "view"), validate({ query: dateV.dateRangeSchema }), analyticsC.gstSummary);

  // ---- Notifications & global search ----
  router.get("/notifications", authorize("notifications", "view"), analyticsC.listNotifications);
  router.put("/notifications/read-all", authorize("notifications", "view"), analyticsC.markAllNotificationsRead);
  router.put("/notifications/:id/read", authorize("notifications", "view"),
    validate({ params: z.object({ id: z.string().uuid() }) }),
    analyticsC.markNotificationRead);
  router.get("/search", authorize("search", "use"), analyticsC.globalSearch);

  return router;
};
