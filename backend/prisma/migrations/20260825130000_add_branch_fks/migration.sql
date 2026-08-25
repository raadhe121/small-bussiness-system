-- Add foreign-key constraints for the branch relations introduced on the
-- tenant models. Columns already exist (nullable) from the add_branches
-- migration; this only enforces referential integrity.

ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;

ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;

ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;

ALTER TABLE "HeldBill" ADD CONSTRAINT "HeldBill_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;

ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;
