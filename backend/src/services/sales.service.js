const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { round2, add, sub, mul, D } = require("../utils/money");
const { applyStockChange, checkLowStockAndNotify, loadBranchStockMap } = require("./inventory.service");

/**
 * Sales & Purchases — the financial core of the app.
 *
 * Every sale/purchase is created in a single Prisma interactive transaction:
 *   1. Lock involved product rows (SELECT ... FOR UPDATE)
 *   2. Validate stock (sales) / prices
 *   3. Create header + line items
 *   4. Apply inventory changes + audit trail
 *   5. Record payment(s) and update party outstanding balances
 * A failure at any step rolls back everything, so partial sales can never
 * corrupt inventory or financial records.
 */

// ---------- helpers ----------

function computeTotals({ items, billDiscount, isInterState }) {
  let subtotal = 0;
  let itemDiscountTotal = 0;
  let totalTax = 0;
  const computedItems = items.map((it) => {
    const gross = round2(mul(it.quantity, it.rate));
    const taxable = Math.max(0, sub(gross, it.discount));
    const taxAmount = round2(mul(taxable, it.taxRate / 100));
    subtotal = add(subtotal, gross);
    itemDiscountTotal = add(itemDiscountTotal, it.discount);
    totalTax = add(totalTax, taxAmount);
    return {
      ...it,
      gross,
      taxable,
      taxAmount,
      lineTotal: add(taxable, taxAmount),
      cost: null,
    };
  });

  // Bill-level discount reduces taxable value proportionally; tax is recomputed.
  let discountRatio = 0;
  const netSubtotal = sub(subtotal, itemDiscountTotal);
  if (billDiscount > 0 && netSubtotal > 0) discountRatio = Math.min(0.9999, billDiscount / netSubtotal);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let taxableTotal = 0;
  for (const it of computedItems) {
    if (discountRatio > 0) {
      const factor = 1 - discountRatio;
      it.taxable = round2(mul(it.taxable, factor));
      it.taxAmount = round2(mul(it.taxAmount, factor));
      it.lineTotal = add(it.taxable, it.taxAmount);
    }
    taxableTotal = add(taxableTotal, it.taxable);
    if (isInterState) igst = add(igst, it.taxAmount);
    else {
      cgst = add(cgst, round2(it.taxAmount / 2));
      sgst = add(sgst, round2(it.taxAmount - it.taxAmount / 2));
    }
  }

  const grandTotal = round2(add(taxableTotal, cgst + sgst + igst));
  return { computedItems, subtotal: round2(subtotal), discount: round2(add(itemDiscountTotal, mul(netSubtotal, discountRatio))), taxableTotal, cgst, sgst, igst, totalTax: round2(cgst + sgst + igst), grandTotal };
}

async function generateInvoiceNo(tx, businessId, prefix) {
  const last = await tx.sale.findFirst({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: { invoiceNo: true },
  });
  let seq = 0;
  if (last?.invoiceNo) {
    const m = last.invoiceNo.match(/(\d+)$/);
    if (m) seq = parseInt(m[1], 10);
  }
  let candidate;
  do {
    seq += 1;
    candidate = `${prefix}-${String(seq).padStart(5, "0")}`;
  } while (
    await tx.sale.findFirst({ where: { businessId, invoiceNo: candidate }, select: { id: true } })
  );
  return candidate;
}

async function validateProducts(businessId, items) {
  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, businessId },
    select: { id: true },
  });
  if (products.length !== ids.length) throw new ApiError(400, "One or more products were not found in your business");
}

// ---------- SALES ----------

async function createSale(scope, user, data) {
  const business = await prisma.business.findUnique({
    where: { id: scope.businessId },
    select: { invoicePrefix: true, state: true, currency: true },
  });
  await validateProducts(scope.businessId, data.items);

  // Resolve inter-state from customer state when not explicitly provided.
  let isInterState = data.isInterState;
  if (data.customerId && !data.isInterState) {
    const [customer, businessFull] = await Promise.all([
      prisma.customer.findFirst({ where: { id: data.customerId, businessId: user.businessId }, select: { state: true } }),
      prisma.business.findUnique({ where: { id: user.businessId }, select: { state: true } }),
    ]);
    isInterState = Boolean(customer?.state && businessFull?.state && customer.state !== businessFull.state);
  }

  const totals = computeTotals({ items: data.items, billDiscount: data.discount, isInterState });
  const paidAmount = round2(Math.min(data.paidAmount, totals.grandTotal));
  const dueAmount = sub(totals.grandTotal, paidAmount);

  return prisma.$transaction(async (tx) => {
    // 1) Lock all product rows up-front (sorted to avoid deadlocks)
    const sortedIds = [...new Set(data.items.map((i) => i.productId))].sort();
    for (const pid of sortedIds) {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${pid} AND "businessId" = ${scope.businessId} FOR UPDATE`;
    }
    const products = await tx.product.findMany({
      where: { id: { in: sortedIds }, businessId: scope.businessId },
      select: { id: true, name: true, currentStock: true, purchasePrice: true, unit: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const branchStockMap = await loadBranchStockMap(tx, scope.branchId, sortedIds);

    // 2) Validate stock (per branch) and compute cost
    let costTotal = 0;
    for (const it of totals.computedItems) {
      const product = productMap.get(it.productId);
      if (!product) throw new ApiError(400, "Product not found in your business");
      const available = branchStockMap.get(it.productId) || 0;
      if (available < it.quantity) {
        throw new ApiError(400, `Insufficient stock for "${product.name}" at this branch. Available: ${available} ${product.unit}, required: ${it.quantity}`);
      }
      costTotal = add(costTotal, round2(mul(it.quantity, product.purchasePrice.toNumber())));
    }
    const profit = sub(sub(totals.subtotal, totals.discount), costTotal);

    // 3) Header
    const invoiceNo = await generateInvoiceNo(tx, user.businessId, business.invoicePrefix);
    const sale = await tx.sale.create({
      data: {
        businessId: user.businessId,
        invoiceNo,
        customerId: data.customerId || null,
        subtotal: new Prisma.Decimal(String(totals.subtotal)),
        discount: new Prisma.Decimal(String(totals.discount)),
        cgst: new Prisma.Decimal(String(totals.cgst)),
        sgst: new Prisma.Decimal(String(totals.sgst)),
        igst: new Prisma.Decimal(String(totals.igst)),
        totalTax: new Prisma.Decimal(String(totals.totalTax)),
        grandTotal: new Prisma.Decimal(String(totals.grandTotal)),
        paidAmount: new Prisma.Decimal(String(paidAmount)),
        dueAmount: new Prisma.Decimal(String(dueAmount)),
        costTotal: new Prisma.Decimal(String(costTotal)),
        profit: new Prisma.Decimal(String(profit)),
        isInterState,
        paymentMethod: data.paymentMethod,
        notes: data.notes || null,
        saleDate: data.saleDate ? new Date(data.saleDate) : new Date(),
        branchId: scope.branchId,
        createdById: user.id,
      },
    });

    // 4) Items + inventory deduction
    for (const it of totals.computedItems) {
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: it.productId,
          productName: productMap.get(it.productId).name,
          quantity: new Prisma.Decimal(String(it.quantity)),
          rate: new Prisma.Decimal(String(it.rate)),
          discount: new Prisma.Decimal(String(it.discount)),
          taxRate: new Prisma.Decimal(String(it.taxRate)),
          taxAmount: new Prisma.Decimal(String(it.taxAmount)),
          lineTotal: new Prisma.Decimal(String(it.lineTotal)),
        },
      });
      const current = branchStockMap.get(it.productId) || 0;
      const newBal = round2(current - it.quantity);
      branchStockMap.set(it.productId, newBal);
      await applyStockChange(tx, {
        businessId: scope.businessId,
        branchId: scope.branchId,
        productId: it.productId,
        type: "SALE",
        quantity: it.quantity,
        branchBalanceAfter: newBal,
        referenceType: "SALE",
        referenceId: sale.id,
        note: `Sold on ${invoiceNo}`,
        userId: user.id,
      });
      await checkLowStockAndNotify(tx, scope.businessId, it.productId, newBal);
    }

    // 5) Payment record + customer outstanding
    if (paidAmount > 0) {
      await tx.payment.create({
        data: {
          businessId: user.businessId,
          direction: "RECEIVED",
          partyType: "SALE",
          branchId: scope.branchId,
          customerId: data.customerId || null,
          saleId: sale.id,
          amount: new Prisma.Decimal(String(paidAmount)),
          method: data.paymentMethod,
          reference: `Sale ${invoiceNo}`,
          paymentDate: data.saleDate ? new Date(data.saleDate) : new Date(),
          createdById: user.id,
        },
      });
    }
    if (dueAmount > 0) {
      if (!data.customerId) throw new ApiError(400, "Walk-in sales must be fully paid");
      const customer = await tx.customer.update({
        where: { id: data.customerId },
        data: { outstanding: { increment: new Prisma.Decimal(String(dueAmount)) } },
      });
      await tx.customerTransaction.create({
        data: {
          businessId: user.businessId,
          customerId: data.customerId,
          type: "INVOICE",
          amount: new Prisma.Decimal(String(dueAmount)),
          balanceAfter: customer.outstanding,
          referenceType: "SALE",
          referenceId: sale.id,
          note: `Due on invoice ${invoiceNo}`,
        },
      });
      if (customer.creditLimit.toNumber() > 0 && customer.outstanding.toNumber() > customer.creditLimit.toNumber()) {
        await tx.notification.create({
          data: {
            businessId: user.businessId,
            type: "CUSTOMER_DUE",
            title: `Credit limit exceeded: ${customer.name}`,
            message: `${customer.name} owes ₹${customer.outstanding.toNumber()} which exceeds their credit limit of ₹${customer.creditLimit.toNumber()}.`,
            link: `/customers/${customer.id}`,
          },
        });
      }
    }

    return getSaleInTx(tx, user.businessId, sale.id);
  });
}

async function getSaleInTx(txOrPrisma, businessId, id) {
  const sale = await txOrPrisma.sale.findFirst({
    where: { id, businessId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true, address: true, city: true, state: true, pincode: true, gstin: true } },
      branch: { select: { id: true, name: true } },
      items: true,
    },
  });
  if (!sale) throw new ApiError(404, "Sale not found");
  return serializeSale(sale);
}

function serializeSale(sale) {
  const num = (v) => (v instanceof Prisma.Decimal ? v.toNumber() : Number(v));
  return {
    ...sale,
    branchId: sale.branchId || null,
    branchName: sale.branch?.name || null,
    subtotal: num(sale.subtotal),
    discount: num(sale.discount),
    cgst: num(sale.cgst),
    sgst: num(sale.sgst),
    igst: num(sale.igst),
    totalTax: num(sale.totalTax),
    grandTotal: num(sale.grandTotal),
    paidAmount: num(sale.paidAmount),
    dueAmount: num(sale.dueAmount),
    profit: sale.profit ? num(sale.profit) : undefined,
    items: sale.items?.map((i) => ({ ...i, quantity: num(i.quantity), rate: num(i.rate), discount: num(i.discount), taxRate: num(i.taxRate), taxAmount: num(i.taxAmount), lineTotal: num(i.lineTotal) })) ?? undefined,
  };
}

async function listSales(scope, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId: scope.businessId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(query.search ? { OR: [
      { invoiceNo: { contains: query.search } },
      ...(query.search.length >= 3 ? [{ customer: { name: { contains: query.search } } }] : []),
    ] } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.from || query.to ? { saleDate: { gte: query.from, lte: query.to } } : {}),
  };
  const [items, total, agg] = await Promise.all([
    prisma.sale.findMany({
      where, skip, take,
      orderBy: { saleDate: "desc" },
      include: { customer: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    }),
    prisma.sale.count({ where }),
    prisma.sale.aggregate({ where, _sum: { grandTotal: true, paidAmount: true, dueAmount: true } }),
  ]);
  return {
    items: items.map((s) => serializeSale(s)),
    meta: buildMeta({ page, limit }, total),
    summary: {
      totalSales: agg._sum.grandTotal?.toNumber() || 0,
      totalPaid: agg._sum.paidAmount?.toNumber() || 0,
      totalDue: agg._sum.dueAmount?.toNumber() || 0,
    },
  };
}

async function getSale(scope, id) {
  return getSaleInTx(prisma, scope.businessId, id);
}

// ---------- PURCHASES ----------

async function createPurchase(scope, user, data) {
  await validateProducts(scope.businessId, data.items);
  const totals = computeTotals({ items: data.items, billDiscount: data.discount, isInterState: false });
  const paidAmount = round2(Math.min(data.paidAmount, totals.grandTotal));
  const dueAmount = sub(totals.grandTotal, paidAmount);

  return prisma.$transaction(async (tx) => {
    const sortedIds = [...new Set(data.items.map((i) => i.productId))].sort();
    for (const pid of sortedIds) {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${pid} AND "businessId" = ${scope.businessId} FOR UPDATE`;
    }
    const products = await tx.product.findMany({
      where: { id: { in: sortedIds }, businessId: scope.businessId },
      select: { id: true, name: true, currentStock: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const branchStockMap = await loadBranchStockMap(tx, scope.branchId, sortedIds);

    const purchase = await tx.purchase.create({
      data: {
        businessId: user.businessId,
        billNo: data.billNo || null,
        supplierId: data.supplierId || null,
        subtotal: new Prisma.Decimal(String(totals.subtotal)),
        discount: new Prisma.Decimal(String(totals.discount)),
        totalTax: new Prisma.Decimal(String(totals.totalTax)),
        grandTotal: new Prisma.Decimal(String(totals.grandTotal)),
        paidAmount: new Prisma.Decimal(String(paidAmount)),
        dueAmount: new Prisma.Decimal(String(dueAmount)),
        paymentMethod: data.paymentMethod,
        notes: data.notes || null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
        branchId: scope.branchId,
        createdById: user.id,
      },
    });

    for (const it of totals.computedItems) {
      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          productId: it.productId,
          productName: productMap.get(it.productId).name,
          quantity: new Prisma.Decimal(String(it.quantity)),
          rate: new Prisma.Decimal(String(it.rate)),
          discount: new Prisma.Decimal(String(it.discount)),
          taxRate: new Prisma.Decimal(String(it.taxRate)),
          taxAmount: new Prisma.Decimal(String(it.taxAmount)),
          lineTotal: new Prisma.Decimal(String(it.lineTotal)),
        },
      });
      const current = branchStockMap.get(it.productId) || 0;
      const newBal = round2(current + it.quantity);
      branchStockMap.set(it.productId, newBal);
      await applyStockChange(tx, {
        businessId: scope.businessId,
        branchId: scope.branchId,
        productId: it.productId,
        type: "PURCHASE",
        quantity: it.quantity,
        branchBalanceAfter: newBal,
        referenceType: "PURCHASE",
        referenceId: purchase.id,
        note: data.billNo ? `Purchase ${data.billNo}` : "Purchase",
        userId: user.id,
      });
    }

    if (paidAmount > 0) {
      await tx.payment.create({
        data: {
          businessId: user.businessId,
          direction: "PAID",
          partyType: "PURCHASE",
          branchId: scope.branchId,
          supplierId: data.supplierId || null,
          purchaseId: purchase.id,
          amount: new Prisma.Decimal(String(paidAmount)),
          method: data.paymentMethod,
          reference: data.billNo ? `Purchase ${data.billNo}` : "Purchase payment",
          paymentDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
          createdById: user.id,
        },
      });
    }
    if (dueAmount > 0 && data.supplierId) {
      const supplier = await tx.supplier.update({
        where: { id: data.supplierId },
        data: { outstanding: { increment: new Prisma.Decimal(String(dueAmount)) } },
      });
      await tx.supplierTransaction.create({
        data: {
          businessId: user.businessId,
          supplierId: data.supplierId,
          type: "PURCHASE",
          amount: new Prisma.Decimal(String(dueAmount)),
          balanceAfter: supplier.outstanding,
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          note: data.billNo ? `Due on bill ${data.billNo}` : "Purchase due",
        },
      });
    }

    return getPurchaseInTx(tx, user.businessId, purchase.id);
  });
}

function serializePurchase(purchase) {
  const s = serializeSale(purchase); // same numeric fields
  delete s.invoiceNo;
  delete s.profit;
  return s;
}

async function listPurchases(scope, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId: scope.businessId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(query.search ? { OR: [
      { billNo: { contains: query.search } },
      ...(query.search.length >= 3 ? [{ supplier: { name: { contains: query.search } } }] : []),
    ] } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.from || query.to ? { purchaseDate: { gte: query.from, lte: query.to } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.purchase.findMany({
      where, skip, take,
      orderBy: { purchaseDate: "desc" },
      include: { supplier: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    }),
    prisma.purchase.count({ where }),
  ]);
  return { items: items.map(serializePurchase), meta: buildMeta({ page, limit }, total) };
}

async function getPurchaseInTx(txOrPrisma, businessId, id) {
  const purchase = await txOrPrisma.purchase.findFirst({
    where: { id, businessId },
    include: {
      supplier: { select: { id: true, name: true, phone: true, email: true, address: true, gstin: true } },
      branch: { select: { id: true, name: true } },
      items: true,
    },
  });
  if (!purchase) throw new ApiError(404, "Purchase not found");
  return serializePurchase(purchase);
}

async function getPurchase(scope, id) {
  return getPurchaseInTx(prisma, scope.businessId, id);
}

// ---------- SALES RETURNS / REFUNDS ----------

function serializeReturn(r) {
  const num = (v) => (v instanceof Prisma.Decimal ? v.toNumber() : Number(v));
  return {
    ...r,
    subtotal: num(r.subtotal),
    totalTax: num(r.totalTax),
    refundTotal: num(r.refundTotal),
    dueAdjusted: num(r.dueAdjusted),
    cashRefunded: num(r.cashRefunded),
    items: r.items?.map((i) => ({ ...i, quantity: num(i.quantity), rate: num(i.rate), taxRate: num(i.taxRate), taxAmount: num(i.taxAmount), refundAmount: num(i.refundAmount) })) ?? undefined,
  };
}

async function generateReturnNo(tx, businessId) {
  const last = await tx.saleReturn.findFirst({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: { returnNo: true },
  });
  let seq = 0;
  if (last?.returnNo) {
    const m = last.returnNo.match(/(\d+)$/);
    if (m) seq = parseInt(m[1], 10);
  }
  let candidate;
  do {
    seq += 1;
    candidate = `RET-${String(seq).padStart(5, "0")}`;
  } while (
    await tx.saleReturn.findFirst({ where: { businessId, returnNo: candidate }, select: { id: true } })
  );
  return candidate;
}

/**
 * Return items from an existing sale.
 * - Restocks returned quantities
 * - Settles refund first against the sale's outstanding due (customer credit note)
 * - Refunds any remainder via CASH/UPI/CARD as a PAID payment record
 */
async function createSaleReturn(scope, user, saleId, data) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, businessId: scope.businessId },
    include: { items: true },
  });
  if (!sale) throw new ApiError(404, "Sale not found");
  const itemMap = new Map(sale.items.map((i) => [i.id, i]));

  // How much of each line has already been returned?
  const returnedRows = await prisma.saleReturnItem.groupBy({
    by: ["saleItemId"],
    where: { saleItemId: { in: sale.items.map((i) => i.id) }, return: { businessId: scope.businessId } },
    _sum: { quantity: true },
  });
  const returnedMap = new Map(returnedRows.map((r) => [r.saleItemId, r._sum.quantity.toNumber()]));

  // Validate + compute per-line refunds (lineTotal includes item discount & tax,
  // so the refund is the exact amount the customer paid for those units).
  let subtotal = 0;
  let totalTax = 0;
  let refundTotal = 0;
  const lines = data.items.map((it) => {
    const si = itemMap.get(it.saleItemId);
    if (!si) throw new ApiError(400, "A return line does not belong to this sale");
    const remaining = si.quantity.toNumber() - (returnedMap.get(si.id) || 0);
    if (it.quantity > remaining) {
      throw new ApiError(400, `Only ${remaining} × "${si.productName}" can still be returned`);
    }
    const qtySold = si.quantity.toNumber();
    const unitRefund = si.lineTotal.toNumber() / qtySold;
    const refundAmount = round2(mul(unitRefund, it.quantity));
    subtotal = add(subtotal, round2(mul(si.rate.toNumber(), it.quantity)));
    totalTax = add(totalTax, round2(mul(si.taxAmount.toNumber() / qtySold, it.quantity)));
    refundTotal = add(refundTotal, refundAmount);
    return {
      saleItemId: si.id,
      productId: si.productId,
      productName: si.productName,
      quantity: it.quantity,
      rate: si.rate.toNumber(),
      taxRate: si.taxRate.toNumber(),
      taxAmount: round2(mul(si.taxAmount.toNumber() / qtySold, it.quantity)),
      refundAmount,
    };
  });

  const method = data.method || "CASH";
  if (!["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"].includes(method)) {
    throw new ApiError(400, "Invalid refund method");
  }

  return prisma.$transaction(async (tx) => {
    // Lock product rows before touching stock
    const opBranchId = sale.branchId || (await tx.branch.findFirst({ where: { businessId: scope.businessId, isDefault: true } }))?.id || null;
    const sortedIds = [...new Set(lines.map((l) => l.productId))].sort();
    for (const pid of sortedIds) {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${pid} AND "businessId" = ${scope.businessId} FOR UPDATE`;
    }
    const products = await tx.product.findMany({
      where: { id: { in: sortedIds }, businessId: scope.businessId },
      select: { id: true, currentStock: true },
    });
    const branchStockMap = opBranchId ? await loadBranchStockMap(tx, opBranchId, sortedIds) : new Map();

    const returnNo = await generateReturnNo(tx, scope.businessId);
    const header = await tx.saleReturn.create({
      data: {
        businessId: scope.businessId,
        returnNo,
        branchId: opBranchId,
        saleId: sale.id,
        customerId: sale.customerId,
        subtotal: new Prisma.Decimal(String(round2(subtotal))),
        totalTax: new Prisma.Decimal(String(round2(totalTax))),
        refundTotal: new Prisma.Decimal(String(refundTotal)),
        method,
        reason: data.reason || null,
        returnDate: data.returnDate ? new Date(data.returnDate) : new Date(),
        createdById: user.id,
      },
    });

    for (const l of lines) {
      await tx.saleReturnItem.create({
        data: {
          returnId: header.id,
          saleItemId: l.saleItemId,
          productId: l.productId,
          productName: l.productName,
          quantity: new Prisma.Decimal(String(l.quantity)),
          rate: new Prisma.Decimal(String(l.rate)),
          taxRate: new Prisma.Decimal(String(l.taxRate)),
          taxAmount: new Prisma.Decimal(String(l.taxAmount)),
          refundAmount: new Prisma.Decimal(String(l.refundAmount)),
        },
      });
      const current = branchStockMap.get(l.productId) ?? 0;
      const newBal = round2(current + l.quantity);
      branchStockMap.set(l.productId, newBal);
      await applyStockChange(tx, {
        businessId: scope.businessId,
        branchId: opBranchId,
        productId: l.productId,
        type: "STOCK_IN",
        quantity: l.quantity,
        branchBalanceAfter: newBal,
        referenceType: "SALE_RETURN",
        referenceId: header.id,
        note: `Returned on ${returnNo} (${sale.invoiceNo})`,
        userId: user.id,
      });
    }

    // Settle against outstanding due first, refund remainder
    const due = sale.dueAmount.toNumber();
    const dueAdjusted = round2(Math.min(due, refundTotal));
    const cashRefunded = round2(sub(refundTotal, dueAdjusted));

    if (dueAdjusted > 0) {
      if (!sale.customerId) throw new ApiError(400, "Cannot adjust due on a walk-in sale");
      const customer = await tx.customer.update({
        where: { id: sale.customerId },
        data: { outstanding: { decrement: new Prisma.Decimal(String(dueAdjusted)) } },
      });
      await tx.customerTransaction.create({
        data: {
          businessId: user.businessId,
          customerId: sale.customerId,
          type: "ADJUSTMENT",
          amount: new Prisma.Decimal(String(dueAdjusted)),
          balanceAfter: customer.outstanding,
          referenceType: "SALE_RETURN",
          referenceId: header.id,
          note: `Credit note ${returnNo} against ${sale.invoiceNo}`,
        },
      });
      await tx.sale.update({ where: { id: sale.id }, data: { dueAmount: { decrement: new Prisma.Decimal(String(dueAdjusted)) } } });
    }

    if (cashRefunded > 0) {
      await tx.payment.create({
        data: {
          businessId: user.businessId,
          direction: "PAID",
          partyType: "SALE_RETURN",
          customerId: sale.customerId || null,
          saleId: sale.id,
          amount: new Prisma.Decimal(String(cashRefunded)),
          method,
          reference: `Refund ${returnNo} for ${sale.invoiceNo}`,
          notes: data.reason || null,
          paymentDate: new Date(),
          createdById: user.id,
        },
      });
    }

    await tx.saleReturn.update({
      where: { id: header.id },
      data: { dueAdjusted: new Prisma.Decimal(String(dueAdjusted)), cashRefunded: new Prisma.Decimal(String(cashRefunded)) },
    });

    const full = await tx.saleReturn.findUnique({ where: { id: header.id }, include: { items: true } });
    return serializeReturn(full);
  });
}

async function listReturns(scope, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId: scope.businessId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(query.search ? { OR: [
      { returnNo: { contains: query.search } },
      ...(query.search.length >= 3 ? [{ sale: { invoiceNo: { contains: query.search } } }] : []),
    ] } : {}),
    ...(query.from || query.to ? { returnDate: { gte: query.from, lte: query.to } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.saleReturn.findMany({
      where, skip, take,
      orderBy: { returnDate: "desc" },
      include: {
        customer: { select: { id: true, name: true } },
        sale: { select: { id: true, invoiceNo: true } },
      },
    }),
    prisma.saleReturn.count({ where }),
  ]);
  return { items: items.map(serializeReturn), meta: buildMeta({ page, limit }, total) };
}

module.exports = {
  computeTotals,
  createSale,
  listSales,
  getSale,
  createPurchase,
  listPurchases,
  getPurchase,
  createSaleReturn,
  listReturns,
};
