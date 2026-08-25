const { z } = require("zod");
const { phone, gstin, pincode } = require("./auth.schema");

const money = z.coerce.number().min(0).max(9999999999);
const qty = z.coerce.number().min(0.001).max(99999999);

const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
});

// ---- Categories ----
const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

const categoryUpdateSchema = categorySchema.partial();

// ---- Products ----
const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  sku: z.string().trim().min(1).max(60),
  barcode: z.string().trim().max(60).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  categoryId: z.string().uuid().nullable().optional(),
  unit: z.enum(["PCS", "KG", "GM", "LITRE", "ML", "METER", "BOX", "PACKET", "DOZEN", "BAG"]).default("PCS"),
  purchasePrice: money.default(0),
  sellingPrice: money,
  taxRate: z.coerce.number().min(0).max(28).default(0),
  minStock: qty.default(5),
  currentStock: qty.optional(),
  openingStock: qty.optional(),
  imageUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "DISABLED"]).default("ACTIVE"),
});

const productUpdateSchema = productSchema.partial();

const productQuerySchema = listQuery.extend({
  categoryId: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  lowStock: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

// ---- Customers / Suppliers ----
const customerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone,
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  address: z.string().trim().max(400).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  pincode: pincode.optional().or(z.literal("")),
  gstin: gstin.optional().or(z.literal("")),
  creditLimit: money.default(0),
});

const customerUpdateSchema = customerSchema.partial();

const supplierSchema = customerSchema.omit({ creditLimit: true });
const supplierUpdateSchema = supplierSchema.partial();

// ---- Payments ----
const paymentMethodEnum = z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "CREDIT", "OTHER"]);

const customerPaymentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  method: paymentMethodEnum.default("CASH"),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  paymentDate: z.string().datetime().optional(),
});

const supplierPaymentSchema = customerPaymentSchema.omit({ customerId: true }).extend({
  supplierId: z.string().uuid(),
});

module.exports = {
  listQuery,
  categorySchema,
  categoryUpdateSchema,
  productSchema,
  productUpdateSchema,
  productQuerySchema,
  customerSchema,
  customerUpdateSchema,
  supplierSchema,
  supplierUpdateSchema,
  customerPaymentSchema,
  supplierPaymentSchema,
  paymentMethodEnum,
};
