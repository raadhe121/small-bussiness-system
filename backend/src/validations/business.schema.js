const { z } = require("zod");
const { phone, gstin, pincode } = require("./auth.schema");

const businessSchema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(160),
  ownerName: z.string().trim().min(2).max(120),
  phone,
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  address: z.string().trim().max(400).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  pincode: pincode.optional().or(z.literal("")),
  gstin: gstin.optional().or(z.literal("")),
  businessType: z
    .enum([
      "KIRANA",
      "CLOTHING",
      "HARDWARE",
      "ELECTRONICS",
      "GENERAL_RETAIL",
      "WHOLESALE",
      "DISTRIBUTION",
      "OTHER",
    ])
    .default("GENERAL_RETAIL"),
  currency: z.string().trim().max(8).default("INR"),
  invoicePrefix: z.string().trim().regex(/^[A-Za-z0-9-]{1,12}$/, "Invoice prefix must be 1-12 letters/digits").default("INV"),
});

const businessUpdateSchema = businessSchema.partial();

const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: phone.optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE", "ACCOUNTANT"]),
  roleId: z.string().uuid().optional().or(z.literal("")),
});

const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phone.optional().or(z.literal("")),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE", "ACCOUNTANT"]).optional(),
  roleId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field to update" });

module.exports = { businessSchema, businessUpdateSchema, userCreateSchema, userUpdateSchema };
