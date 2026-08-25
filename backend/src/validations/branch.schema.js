const z = require("zod");

const branchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const branchUpdateSchema = branchSchema.partial();

module.exports = { branchSchema, branchUpdateSchema };
