/**
 * One-time (idempotent) data backfill for the multi-branch rollout.
 *
 * Before branches existed, stock lived only in Product.currentStock (a
 * business-wide total). The new model tracks stock PER BRANCH via BranchStock,
 * so every existing product with stock must get a BranchStock row on its
 * business's default branch (created here if missing).
 *
 * Idempotent: it only CREATES a BranchStock row when one does not already exist
 * for the product + default branch, so re-running on every deploy is safe.
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function backfillForBusiness(businessId) {
  let branch = await prisma.branch.findFirst({ where: { businessId, isDefault: true } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { businessId, name: "Main", code: "MAIN", isDefault: true },
    });
  }

  const products = await prisma.product.findMany({
    where: { businessId, currentStock: { gt: 0 } },
    select: { id: true, currentStock: true },
  });

  let created = 0;
  for (const p of products) {
    const existing = await prisma.branchStock.findUnique({
      where: { branchId_productId: { branchId: branch.id, productId: p.id } },
    });
    if (existing) continue;
    await prisma.branchStock.create({
      data: {
        businessId,
        branchId: branch.id,
        productId: p.id,
        quantity: Number(p.currentStock),
      },
    });
    created += 1;
  }
  return created;
}

(async () => {
  const businesses = await prisma.business.findMany({ select: { id: true, name: true } });
  let total = 0;
  for (const b of businesses) {
    const n = await backfillForBusiness(b.id);
    if (n) console.log(`Backfilled ${n} product(s) for business ${b.name}`);
    total += n;
  }
  console.log(`Branch-stock backfill complete (${total} new row(s)).`);
  await prisma.$disconnect();
})().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
