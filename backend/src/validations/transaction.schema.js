const { z } = require("zod");
const { paymentMethodEnum } = require("./catalog.schema");

const lineItem = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive().max(99999999),
  rate: z.coerce.number().min(0).max(9999999999),
  discount: z.coerce.number().min(0).max(9999999999).default(0),
  taxRate: z.coerce.number().min(0).max(28).default(0),
});

const saleSchema = z
  .object({
    customerId: z.string().uuid().nullable().optional(),
    items: z.array(lineItem).min(1, "Add at least one item"),
    discount: z.coerce.number().min(0).max(9999999999).default(0), // extra bill-level discount
    isInterState: z.boolean().default(false),
    branchId: z.string().uuid().optional(),
    paymentMethod: paymentMethodEnum.default("CASH"),
    paidAmount: z.coerce.number().min(0).default(0),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    saleDate: z.string().datetime().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.paymentMethod === "CREDIT" && !val.customerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A customer is required for credit sales", path: ["customerId"] });
    }
  });

const saleReturnSchema = z.object({
  items: z
    .array(
      z.object({
        saleItemId: z.string().uuid(),
        quantity: z.coerce.number().positive().max(99999999),
      })
    )
    .min(1, "Add at least one item to return"),
  method: paymentMethodEnum.default("CASH"),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
  returnDate: z.string().datetime().optional(),
  branchId: z.string().uuid().optional(),
});

// Parked bills from the POS (hold / resume). The cart is carried as JSON.
const holdBillSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().trim().max(160).optional().or(z.literal("")),
  paymentMethod: paymentMethodEnum.default("CASH"),
  discount: z.coerce.number().min(0).max(9999999999).default(0),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  total: z.coerce.number().min(0).default(0),
  branchId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        name: z.string().min(1),
        unit: z.string().max(20).optional().or(z.literal("")),
        quantity: z.coerce.number().positive(),
        rate: z.coerce.number().min(0),
        discount: z.coerce.number().min(0).default(0),
        taxRate: z.coerce.number().min(0).max(28).default(0),
      })
    )
    .min(1, "A held bill must contain at least one item"),
});

const purchaseSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  billNo: z.string().trim().max(40).optional().or(z.literal("")),
  branchId: z.string().uuid().optional(),
  items: z.array(lineItem).min(1, "Add at least one item"),
  discount: z.coerce.number().min(0).max(9999999999).default(0),
  paymentMethod: paymentMethodEnum.default("CASH"),
  paidAmount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  purchaseDate: z.string().datetime().optional(),
});

// ---- Inventory ----
const stockAdjustSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]),
  branchId: z.string().uuid().optional(),
  quantity: z.coerce.number().positive().max(99999999),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

const transferSchema = z.object({
  productId: z.string().uuid(),
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  quantity: z.coerce.number().positive().max(99999999),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

const inventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  lowStock: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

const txnQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  productId: z.string().uuid().optional(),
  type: z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "SALE", "PURCHASE", "TRANSFER_IN", "TRANSFER_OUT"]).optional(),
});

// ---- Expenses ----
const expenseCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const expenseSchema = z.object({
  expenseCategoryId: z.string().uuid(),
  amount: z.coerce.number().positive().max(9999999999),
  method: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"]).default("CASH"),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  receiptUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  expenseDate: z.string().datetime().optional(),
  branchId: z.string().uuid().optional(),
});

const expenseUpdateSchema = expenseSchema.partial();

module.exports = {
  saleSchema,
  saleReturnSchema,
  holdBillSchema,
  purchaseSchema,
  stockAdjustSchema,
  transferSchema,
  inventoryQuerySchema,
  txnQuerySchema,
  expenseCategorySchema,
  expenseSchema,
  expenseUpdateSchema,
};
