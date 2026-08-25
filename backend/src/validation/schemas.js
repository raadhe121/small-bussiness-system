const { z } = require("zod");

// ---------- shared ----------

const phone = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s-]{6,19}$/, "Enter a valid phone number");

const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}[0-9A-Z]$/, "Enter a valid GSTIN (e.g. 27ABCDE1234F1Z5)")
  .or(z.literal(""));

const money = z.coerce.number().min(0, "Must be zero or greater").max(9999999999);

const qty = z.coerce.number().min(0.001).max(99999999);

const idField = z.string().uuid().or(z.string().min(1).max(36));

const paymentMethodEnum = z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "CREDIT", "OTHER"]);

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

const optionalDateStr = z.undefined().or(z.null()).or(dateStr);

// Pagination query used by most list endpoints.
const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
}).passthrough();

// Date-range query for reports.
const rangeQuery = z.object({
  from: dateStr.optional(),
  to: dateStr.optional(),
});

// ---------- auth ----------

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: phone.optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8).max(72),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phone.optional(),
});

// ---------- business ----------

const businessSchema = z.object({
  name: z.string().trim().min(2).max(160),
  ownerName: z.string().trim().min(2).max(120),
  phone: phone,
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  address: z.string().trim().max(400).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits").optional().or(z.literal("")),
  gstin: gstin.optional(),
  businessType: z.string().trim().max(60).default("GENERAL_RETAIL"),
  currency: z.string().trim().max(8).default("INR"),
  invoicePrefix: z.string().trim().toUpperCase().max(12).default("INV"),
  logoUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
});

const businessUpdateSchema = businessSchema.partial().extend({
  invoiceTerms: z.string().trim().max(2000).optional().or(z.literal("")),
  upiId: z.string().trim().max(120).optional().or(z.literal("")),
  bankDetails: z.string().trim().max(300).optional().or(z.literal("")),
  defaultGstRate: z.coerce.number().min(0).max(40).optional(),
  lowStockAlertsEnabled: z.boolean().optional(),
  paymentDueAlertsEnabled: z.boolean().optional(),
});

// ---------- users ----------

const roleEnum = z.enum(["ADMIN", "MANAGER", "EMPLOYEE", "ACCOUNTANT"]);

const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: phone.optional(),
  password: z.string().min(8).max(72),
  role: roleEnum.default("EMPLOYEE"),
});

const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phone.optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(72).optional(),
});

// ---------- categories ----------

const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

// ---------- products ----------

const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  barcode: z.string().trim().max(60).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  categoryId: idField.nullish(),
  unit: z.string().trim().max(20).default("PCS"),
  purchasePrice: money.default(0),
  sellingPrice: money,
  taxRate: z.coerce.number().min(0).max(40).default(0),
  minStock: qty.default(5),
  openingStock: qty.default(0),
  imageUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
});

const productPatchSchema = productSchema.partial();

const productQuery = paginationQuery.extend({
  categoryId: idField.optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  lowStock: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(["name", "createdAt", "sellingPrice", "currentStock"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ---------- inventory ----------

const stockAdjustSchema = z.object({
  productId: idField,
  type: z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().min(0.001).max(9999999),
  note: z.string().trim().max(300).optional(),
});

// ---------- customers / suppliers ----------

const customerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: phone,
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  address: z.string().trim().max(400).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  pincode: z.string().trim().max(10).optional().or(z.literal("")),
  gstin: gstin.optional(),
  creditLimit: money.default(0),
});

const customerPatchSchema = customerSchema.partial();

const supplierSchema = customerSchema;
const supplierPatchSchema = supplierSchema.partial();

// ---------- sales / purchases ----------

const saleItemSchema = z.object({
  productId: idField,
  quantity: qty,
  rate: money.optional(), // defaults to product selling price
  discount: money.optional().default(0), // absolute amount for the line
  taxRate: z.coerce.number().min(0).max(40).optional(), // defaults to product tax rate
});

const saleSchema = z.object({
  customerId: idField.nullish(),
  items: z.array(saleItemSchema).min(1, "Add at least one item"),
  isInterState: z.boolean().default(false),
  paymentMethod: paymentMethodEnum.default("CASH"),
  paidAmount: money.default(0),
  notes: z.string().trim().max(500).optional(),
  saleDate: optionalDateStr,
});

const purchaseItemSchema = z.object({
  productId: idField,
  quantity: qty,
  rate: money, // purchase price per unit (pre-tax)
  discount: money.optional().default(0),
  taxRate: z.coerce.number().min(0).max(40).default(0),
});

const purchaseSchema = z.object({
  supplierId: idField.nullish(),
  billNo: z.string().trim().max(40).optional().or(z.literal("")),
  items: z.array(purchaseItemSchema).min(1, "Add at least one item"),
  paymentMethod: paymentMethodEnum.default("CASH"),
  paidAmount: money.default(0),
  updateCost: z.boolean().default(true),
  notes: z.string().trim().max(500).optional(),
  purchaseDate: optionalDateStr,
});

// ---------- payments ----------

const paymentSchema = z.object({
  direction: z.enum(["RECEIVED", "PAID"]),
  partyId: idField, // customerId when RECEIVED, supplierId when PAID
  amount: z.coerce.number().min(0.01).max(999999999),
  method: paymentMethodEnum.refine((m) => m !== "CREDIT", "CREDIT is not a valid payment method"),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  saleId: idField.optional(),
  purchaseId: idField.optional(),
  paymentDate: optionalDateStr,
});

// ---------- expenses ----------

const expenseCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const expenseSchema = z.object({
  expenseCategoryId: idField,
  amount: money.refine((v) => v > 0, "Amount must be greater than zero"),
  method: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"]).default("CASH"),
  reference: z.string().trim().max(120).optional(),
  receiptUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional(),
  expenseDate: optionalDateStr,
});

const expensePatchSchema = expenseSchema.partial();

module.exports = {
  phone,
  gstin,
  money,
  paginationQuery,
  rangeQuery,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileSchema,
  businessSchema,
  businessUpdateSchema,
  userCreateSchema,
  userUpdateSchema,
  categorySchema,
  productSchema,
  productPatchSchema,
  productQuery,
  stockAdjustSchema,
  customerSchema,
  customerPatchSchema,
  supplierSchema,
  supplierPatchSchema,
  saleSchema,
  purchaseSchema,
  paymentSchema,
  expenseCategorySchema,
  expenseSchema,
  expensePatchSchema,
};
