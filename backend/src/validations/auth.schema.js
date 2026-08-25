const { z } = require("zod");

const email = z.string().trim().toLowerCase().email("Invalid email address");
const password = z.string().min(8, "Password must be at least 8 characters").max(72);
const phone = z
  .string()
  .trim()
  .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a valid Indian mobile number");
const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}[0-9A-Z]$/, "Enter a valid GSTIN");
const pincode = z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits");

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  phone,
  password,
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({ email });

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password,
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phone.optional(),
}).refine((d) => d.name !== undefined || d.phone !== undefined, {
  message: "Provide at least one field to update",
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  phone,
  gstin,
  pincode,
};
