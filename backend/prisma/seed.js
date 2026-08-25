/* eslint-disable no-console */
/**
 * Demo seed. Creates:
 *   Business : "Sharma Kirana & General Store" (Jaipur, Rajasthan)
 *   Owner    : demo@businesshub.in / Demo@1234
 *   Staff    : manager@ / accountant@ / employee@businesshub.in (same password)
 *   Categories, products w/ inventory, customers, suppliers,
 *   purchases, sales (last 14 days), payments and expenses.
 *
 * Run: npm run db:seed
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const prisma = new PrismaClient();

// eslint-disable-next-line no-undef
const dec = (v) => decimalOf(v);
function decimalOf(v) {
  const { Prisma } = require("@prisma/client");
  return new Prisma.Decimal(String(v));
}

const daysAgo = (n, hour = 11) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 50), 0, 0);
  return d;
};

async function main() {
  console.log("Seeding demo data...");
  const passwordHash = await bcrypt.hash("Demo@1234", 10);

  // Idempotent: wipe all previous data (order-safe via FK checks toggle).
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
  const tables = [
    "CustomerTransaction", "SupplierTransaction", "InventoryTransaction", "Notification",
    "SaleItem", "Sale", "PurchaseItem", "Purchase", "Payment", "Expense", "ExpenseCategory",
    "Inventory", "Product", "Category", "Customer", "Supplier", "User", "Business",
  ];
  for (const t of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``);
  }
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");

  const business = await prisma.business.create({
    data: {
      name: "Sharma Kirana & General Store",
      ownerName: "Rajesh Sharma",
      phone: "+919876543210",
      email: "owner@sharmakirana.in",
      address: "Shop 14, Malviya Nagar Market",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302017",
      gstin: "08ABCDE1234F1Z5",
      businessType: "KIRANA",
      invoicePrefix: "SKGS",
      upiId: "sharmakirana@upi",
      defaultGstRate: 18,
    },
  });

  const staff = [
    { name: "Rajesh Sharma", email: "demo@businesshub.in", role: "OWNER" },
    { name: "Priya Verma", email: "manager@businesshub.in", role: "MANAGER" },
    { name: "Amit Jain", email: "accountant@businesshub.in", role: "ACCOUNTANT" },
    { name: "Sunil Kumar", email: "employee@businesshub.in", role: "EMPLOYEE" },
  ];
  for (const s of staff) {
    await prisma.user.create({
      data: { ...s, businessId: business.id, passwordHash, phone: "+91999990000" + (staff.indexOf(s) + 1) },
    });
  }

  const catNames = ["Groceries", "Dairy & Bakery", "Personal Care", "Household", "Beverages"];
  const cats = {};
  for (const name of catNames) {
    cats[name] = await prisma.category.create({
      data: { businessId: business.id, name, description: `${name} products` },
    });
  }

  // Default expense categories
  const expCats = {};
  for (const name of ["Rent", "Salaries", "Transport", "Electricity", "Marketing", "Other"]) {
    expCats[name] = await prisma.expenseCategory.create({
      data: { businessId: business.id, name },
    });
  }

  const productDefs = [
    ["Aashirvaad Atta 10kg", "Groceries", "BAG", 380, 445, 5, 40, 12],
    ["Tata Salt 1kg", "Groceries", "PCS", 22, 28, 0, 120, 30],
    ["Fortune Sunflower Oil 1L", "Groceries", "BTL", 128, 155, 5, 60, 15],
    ["Amul Butter 500g", "Dairy & Bakery", "PCS", 245, 275, 12, 35, 8],
    ["Britannia Bread", "Dairy & Bakery", "PCS", 38, 45, 5, 25, 10],
    ["Nestle Milk Powder 400g", "Dairy & Bakery", "TIN", 235, 265, 5, 20, 6],
    ["Colgate Strong Teeth 200g", "Personal Care", "PCS", 92, 110, 18, 50, 12],
    ["Lux Soap Pack of 4", "Personal Care", "PKT", 105, 132, 18, 45, 10],
    ["Surf Excel Easy Wash 1kg", "Household", "PCS", 118, 140, 18, 55, 15],
    ["Harpic Toilet Cleaner 1L", "Household", "BTL", 165, 199, 18, 30, 8],
    ["Vim Dishwash Bar 200g", "Household", "PCS", 18, 24, 18, 100, 25],
    ["Parle-G Family Pack", "Beverages", "PCS", 78, 95, 18, 80, 20],
    ["Tata Tea Gold 500g", "Beverages", "PCS", 255, 290, 5, 40, 10],
    ["Real Mixed Fruit Juice 1L", "Beverages", "BTL", 99, 120, 12, 36, 9],
    ["Maggi Noodles 12-pack", "Beverages", "PKT", 168, 192, 12, 48, 12],
    ["Dettol Handwash Refill 750ml", "Personal Care", "BTL", 145, 175, 18, 28, 7], // intentionally low stock
    ["Haldiram Bhujia 350g", "Groceries", "PKT", 85, 105, 12, 42, 10],
    ["Everest Garam Masala 100g", "Groceries", "PCS", 68, 82, 5, 34, 9],
  ];

  const products = [];
  for (const [name, catName, unit, pp, sp, tax, stock, minStock] of productDefs) {
    const p = await prisma.product.create({
      data: {
        businessId: business.id,
        categoryId: cats[catName].id,
        name,
        sku: `SKU-${String(products.length + 1).padStart(4, "0")}`,
        unit,
        purchasePrice: dec(pp),
        sellingPrice: dec(sp),
        taxRate: dec(tax),
        minStock: dec(minStock),
        currentStock: dec(stock),
        barcode: `890${String(100000000 + products.length)}`,
      },
    });
    await prisma.inventory.create({
      data: { businessId: business.id, productId: p.id, quantity: dec(stock), location: "Main Shop" },
    });
    products.push(p);
  }
  // Make the last-but-one product low on stock to trigger alerts.
  await prisma.product.update({
    where: { id: products[16].id },
    data: { currentStock: dec(3) },
  });
  await prisma.inventory.update({
    where: { productId: products[16].id },
    data: { quantity: dec(3) },
  });

  const supplierDefs = [
    ["Metro Wholesale Distributors", "+919414000001", "metro@wholesale.in", "08AAAPL1234C1ZV"],
    ["Rajput Traders", "+919414000002", "sales@rajputtraders.in", "08AACCR9876D1ZR"],
    ["Gupta Foods Pvt Ltd", "+919414000003", "orders@guptafoods.in", "08AADCG5432E1ZQ"],
  ];
  const suppliers = [];
  for (const [name, phone, email, gstin] of supplierDefs) {
    suppliers.push(
      await prisma.supplier.create({
        data: { businessId: business.id, name, phone, email, gstin, city: "Jaipur", state: "Rajasthan" },
      })
    );
  }

  const customerDefs = [
    ["Walk-in Customer", "+919800000000"],
    ["Sunita Agarwal", "+919800000101"],
    ["Vikram Singh Chundawat", "+919800000102"],
    ["Hotel Anandam", "+919800000103", "08AABCH1111F1ZX"],
    ["Neha Gupta", "+919800000104"],
    ["Shree Ram Tiffin Center", "+919800000105"],
  ];
  const customers = [];
  for (const [name, phone, gstin] of customerDefs) {
    customers.push(
      await prisma.customer.create({
        data: { businessId: business.id, name, phone, gstin: gstin || null, creditLimit: dec(gstin ? 25000 : 5000), city: "Jaipur", state: "Rajasthan" },
      })
    );
  }

  const owner = await prisma.user.findUnique({ where: { email: "demo@businesshub.in" } });
  const employee = await prisma.user.findUnique({ where: { email: "employee@businesshub.in" } });

  // ---------- purchases ----------
  let billSeq = 0;
  async function doPurchase(supplier, picks, paidRatio, when) {
    billSeq += 1;
    let taxable = 0;
    let taxTotal = 0;
    const items = picks.map(([p, qty]) => {
      const rate = Number(p.purchasePrice);
      const lineTaxable = rate * qty;
      const lineTax = (lineTaxable * Number(p.taxRate)) / 100;
      taxable += lineTaxable;
      taxTotal += lineTax;
      return { p, qty, rate };
    });
    const grand = Math.round((taxable + taxTotal) * 100) / 100;
    const paid = Math.round(grand * paidRatio * 100) / 100;
    const due = Math.round((grand - paid) * 100) / 100;

    const purchase = await prisma.purchase.create({
      data: {
        businessId: business.id,
        billNo: `BILL-2026-${String(billSeq).padStart(5, "0")}`,
        supplierId: supplier.id,
        subtotal: dec(Math.round(taxable * 100) / 100),
        totalTax: dec(Math.round(taxTotal * 100) / 100),
        grandTotal: dec(grand),
        paidAmount: dec(paid),
        dueAmount: dec(due),
        paymentMethod: paidRatio >= 1 ? "CASH" : "BANK_TRANSFER",
        purchaseDate: when,
        createdById: owner.id,
        items: {
          create: items.map(({ p, qty, rate }) => ({
            productId: p.id,
            productName: p.name,
            quantity: dec(qty),
            rate: dec(rate),
            taxable: dec(rate * qty),
            taxRate: p.taxRate,
            taxAmount: dec(((rate * qty) * Number(p.taxRate)) / 100),
            lineTotal: dec(rate * qty * (1 + Number(p.taxRate) / 100)),
          })),
        },
      },
    });

    await prisma.payment.create({
      data: {
        businessId: business.id,
        direction: "PAID",
        partyType: "PURCHASE",
        supplierId: supplier.id,
        purchaseId: purchase.id,
        amount: dec(paid),
        method: paidRatio >= 1 ? "CASH" : "BANK_TRANSFER",
        reference: purchase.billNo,
        paymentDate: when,
        createdById: owner.id,
      },
    });

    if (due > 0 && supplier) {
      const s = await prisma.supplier.update({
        where: { id: supplier.id },
        data: { outstanding: { increment: dec(due) } },
      });
      await prisma.supplierTransaction.create({
        data: {
          businessId: business.id,
          supplierId: supplier.id,
          type: "PURCHASE",
          amount: dec(due),
          balanceAfter: s.outstanding,
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          note: `Bill ${purchase.billNo}`,
        },
      });
    }
    return purchase;
  }

  await doPurchase(suppliers[0], [[products[0], 20], [products[2], 24]], 1, daysAgo(13, 9));
  await doPurchase(suppliers[1], [[products[6], 30], [products[8], 30], [products[16].id ? products[16] : products[3], 20]], 0.6, daysAgo(9, 10));
  await doPurchase(suppliers[2], [[products[11], 40], [products[14], 24]], 0.5, daysAgo(5, 9));
  await doPurchase(suppliers[0], [[products[3], 15], [products[4], 30]], 1, daysAgo(2, 8));

  // ---------- sales over last 14 days ----------
  const methods = ["CASH", "UPI", "UPI", "CARD", "CREDIT"];
  let invSeq = 0;
  const ymPrefix = `SKGS-${String(new Date().getFullYear()).slice(2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-`;

  for (let dayBack = 13; dayBack >= 0; dayBack -= 1) {
    const salesToday = dayBack === 0 ? 3 : 1 + Math.floor(Math.random() * 3);
    for (let s = 0; s < salesToday; s += 1) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const method = methods[Math.floor(Math.random() * methods.length)];
      const itemCount = 1 + Math.floor(Math.random() * 3);
      const picked = new Set();
      const lines = [];
      for (let i = 0; i < itemCount; i += 1) {
        let idx = Math.floor(Math.random() * products.length);
        while (picked.has(idx)) idx = (idx + 1) % products.length;
        picked.add(idx);
        const p = products[idx];
        lines.push({ p, qty: 1 + Math.floor(Math.random() * 4) });
      }
      let taxable = 0;
      let taxSum = 0;
      let cost = 0;
      for (const { p, qty } of lines) {
        const t = Number(p.sellingPrice) * qty;
        taxable += t;
        taxSum += (t * Number(p.taxRate)) / 100;
        cost += Number(p.purchasePrice) * qty;
      }
      taxable = Math.round(taxable * 100) / 100;
      taxSum = Math.round(taxSum * 100) / 100;
      const grand = Math.round((taxable + taxSum) * 100) / 100;
      const isCredit = method === "CREDIT";
      const paid = isCredit ? 0 : grand;
      const due = grand - paid;
      invSeq += 1;
      const when = daysAgo(dayBack, 10 + (s % 8));

      const sale = await prisma.sale.create({
        data: {
          businessId: business.id,
          invoiceNo: `${ymPrefix}${String(invSeq).padStart(4, "0")}`,
          customerId: customer.name === "Walk-in Customer" ? null : customer.id,
          subtotal: dec(taxable),
          cgst: isCredit || true ? dec(taxSum / 2) : dec(0),
          sgst: dec(taxSum / 2),
          totalTax: dec(taxSum),
          grandTotal: dec(grand),
          paidAmount: dec(paid),
          dueAmount: dec(due),
          costTotal: dec(Math.round(cost * 100) / 100),
          profit: dec(Math.round((taxable - cost) * 100) / 100),
          paymentMethod: isCredit ? "CREDIT" : method === "CREDIT" ? "CASH" : method,
          saleDate: when,
          createdById: Math.random() > 0.5 ? owner.id : employee.id,
          items: {
            create: lines.map(({ p, qty }) => ({
              productId: p.id,
              productName: p.name,
              quantity: dec(qty),
              rate: dec(Number(p.sellingPrice)),
              taxable: dec(Number(p.sellingPrice) * qty),
              taxRate: p.taxRate,
              taxAmount: dec((Number(p.sellingPrice) * qty * Number(p.taxRate)) / 100),
              lineTotal: dec(Number(p.sellingPrice) * qty * (1 + Number(p.taxRate) / 100)),
            })),
          },
        },
      });

      if (!isCredit) {
        await prisma.payment.create({
          data: {
            businessId: business.id,
            direction: "RECEIVED",
            partyType: "SALE",
            customerId: customer.name === "Walk-in Customer" ? null : customer.id,
            saleId: sale.id,
            amount: dec(paid),
            method: method === "CREDIT" ? "CASH" : method,
            reference: sale.invoiceNo,
            notes: "Collected at time of sale",
            paymentDate: when,
            createdById: owner.id,
          },
        });
      } else {
        const c = await prisma.customer.update({
          where: { id: customer.id },
          data: { outstanding: { increment: dec(due) } },
        });
        await prisma.customerTransaction.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            type: "INVOICE",
            amount: dec(due),
            balanceAfter: c.outstanding,
            referenceType: "SALE",
            referenceId: sale.id,
            note: `Invoice ${sale.invoiceNo}`,
          },
        });
      }

      // Reduce stock
      for (const { p, qty } of lines) {
        const fresh = await prisma.product.findUnique({ where: { id: p.id } });
        const balanceAfter = Number(fresh.currentStock) - qty;
        if (balanceAfter < 0) continue;
        await prisma.product.update({ where: { id: p.id }, data: { currentStock: dec(balanceAfter) } });
        await prisma.inventory.update({ where: { productId: p.id }, data: { quantity: dec(balanceAfter) } });
        await prisma.inventoryTransaction.create({
          data: {
            businessId: business.id,
            productId: p.id,
            type: "SALE",
            quantity: dec(qty),
            balanceAfter: dec(balanceAfter),
            referenceType: "SALE",
            referenceId: sale.id,
            note: `Sold on invoice ${sale.invoiceNo}`,
            createdBy: owner.id,
            createdAt: when,
          },
        });
      }
    }
  }

  // ---------- standalone expenses ----------
  const expenseRows = [
    [expCats["Rent"], 15000, daysAgo(12)],
    [expCats["Electricity"], 2340, daysAgo(10)],
    [expCats["Transport"], 850, daysAgo(8)],
    [expCats["Salaries"], 24000, daysAgo(6)],
    [expCats["Transport"], 420, daysAgo(4)],
    [expCats["Marketing"], 1500, daysAgo(3)],
    [expCats["Other"], 260, daysAgo(1)],
  ];
  for (const [cat, amount, when] of expenseRows) {
    await prisma.expense.create({
      data: {
        businessId: business.id,
        expenseCategoryId: cat.id,
        amount: dec(amount),
        method: amount > 5000 ? "BANK_TRANSFER" : "CASH",
        description: `${cat.name} expense`,
        expenseDate: when,
        createdById: owner.id,
      },
    });
  }

  // ---------- a customer payment against outstanding ----------
  const owingCustomer = await prisma.customer.findFirst({
    where: { businessId: business.id, outstanding: { gt: 0 } },
  });
  if (owingCustomer) {
    const pay = Math.min(500, Number(owingCustomer.outstanding));
    const c = await prisma.customer.update({
      where: { id: owingCustomer.id },
      data: { outstanding: { decrement: dec(pay) } },
    });
    await prisma.payment.create({
      data: {
        businessId: business.id,
        direction: "RECEIVED",
        partyType: "CUSTOMER",
        customerId: owingCustomer.id,
        amount: dec(pay),
        method: "UPI",
        reference: "UPI collection",
        paymentDate: daysAgo(1, 18),
        createdById: owner.id,
      },
    });
    await prisma.customerTransaction.create({
      data: {
        businessId: business.id,
        customerId: owingCustomer.id,
        type: "PAYMENT_IN",
        amount: dec(pay),
        balanceAfter: c.outstanding,
        referenceType: "PAYMENT",
        note: "Part payment received via UPI",
      },
    });
  }

  console.log("\n✅ Seed complete!");
  console.log("──────────────────────────────────────────────────");
  console.log("Demo login credentials:");
  console.log("  OWNER      : demo@businesshub.in      / Demo@1234");
  console.log("  MANAGER    : manager@businesshub.in   / Demo@1234");
  console.log("  ACCOUNTANT : accountant@businesshub.in/ Demo@1234");
  console.log("  EMPLOYEE   : employee@businesshub.in  / Demo@1234");
  console.log("──────────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
