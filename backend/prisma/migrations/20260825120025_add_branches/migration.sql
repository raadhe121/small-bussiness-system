-- AlterTable
ALTER TABLE "User" ADD COLUMN     "branchId" CHAR(36);

-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "branchId" CHAR(36);

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "branchId" CHAR(36);

-- AlterTable
ALTER TABLE "SaleReturn" ADD COLUMN     "branchId" CHAR(36);

-- AlterTable
ALTER TABLE "HeldBill" ADD COLUMN     "branchId" CHAR(36);

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "branchId" CHAR(36);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "branchId" CHAR(36);

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "branchId" CHAR(36);

-- CreateTable
CREATE TABLE "Branch" (
    "id" CHAR(36) NOT NULL,
    "businessId" CHAR(36) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(20),
    "address" VARCHAR(400),
    "phone" VARCHAR(20),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchStock" (
    "id" CHAR(36) NOT NULL,
    "businessId" CHAR(36) NOT NULL,
    "branchId" CHAR(36) NOT NULL,
    "productId" CHAR(36) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Branch_businessId_idx" ON "Branch"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_businessId_code_key" ON "Branch"("businessId", "code");

-- CreateIndex
CREATE INDEX "BranchStock_businessId_idx" ON "BranchStock"("businessId");

-- CreateIndex
CREATE INDEX "BranchStock_productId_idx" ON "BranchStock"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchStock_branchId_productId_key" ON "BranchStock"("branchId", "productId");

-- CreateIndex
CREATE INDEX "User_branchId_idx" ON "User"("branchId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_branchId_idx" ON "InventoryTransaction"("branchId");

-- CreateIndex
CREATE INDEX "Sale_branchId_idx" ON "Sale"("branchId");

-- CreateIndex
CREATE INDEX "SaleReturn_branchId_idx" ON "SaleReturn"("branchId");

-- CreateIndex
CREATE INDEX "HeldBill_branchId_idx" ON "HeldBill"("branchId");

-- CreateIndex
CREATE INDEX "Purchase_branchId_idx" ON "Purchase"("branchId");

-- CreateIndex
CREATE INDEX "Payment_branchId_idx" ON "Payment"("branchId");

-- CreateIndex
CREATE INDEX "Expense_branchId_idx" ON "Expense"("branchId");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchStock" ADD CONSTRAINT "BranchStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchStock" ADD CONSTRAINT "BranchStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchStock" ADD CONSTRAINT "BranchStock_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

