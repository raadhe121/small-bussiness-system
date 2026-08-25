const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { paginate } = require("../utils/paginate");
const { D, round2 } = require("../utils/money");

/**
 * Standalone payments (against customer/supplier outstanding balances).
 * Updates the party balance + ledger + optionally the source sale/purchase due
 * — all inside one transaction.
 */
async function createPayment(businessId, userId, data) {
  const amount = round2(data.amount);
  const paymentDate = data.paymentDate || new Date();

  return prisma.$transaction(async (tx) => {
    if (data.direction === "RECEIVED") {
      const customer = await tx.customer.findFirst({ where: { id: data.partyId, businessId } });
      if (!customer) throw new ApiError(404, "Customer not found");

      let saleDueLeft = null;
      if (data.saleId) {
        const sale = await tx.sale.findFirst({
          where: { id: data.saleId, businessId, customerId: data.partyId },
        });
        if (!sale) throw new ApiError(404, "Sale not found for this customer");
      }

      const updated = await tx.customer.update({
        where: { id: customer.id },
        data: { outstanding: { decrement: D(amount) } },
      });
      await tx.customerTransaction.create({
        data: {
          businessId,
          customerId: customer.id,
          type: "PAYMENT_IN",
          amount: D(amount),
          balanceAfter: updated.outstanding,
          referenceType: "PAYMENT",
          note: data.reference || "Customer payment",
        },
      });

      const payment = await tx.payment.create({
        data: {
          businessId,
          direction: "RECEIVED",
          partyType: data.saleId ? "SALE" : "CUSTOMER",
          customerId: customer.id,
          saleId: data.saleId || null,
          amount: D(amount),
          method: data.method,
          reference: data.reference || null,
          notes: data.notes || null,
          paymentDate,
          createdById: userId,
        },
      });

      // Apply against a specific invoice's remaining due when provided.
      if (data.saleId) {
        const sale = await tx.sale.findUnique({ where: { id: data.saleId } });
        const applied = Math.min(amount, Number(sale.dueAmount));
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: { increment: D(applied) },
            dueAmount: { decrement: D(applied) },
          },
        });
        saleDueLeft = Number(sale.dueAmount) - applied;
      }
      return { payment, balanceAfter: updated.outstanding, saleDueLeft };
    }

    // PAID — supplier payment
    const supplier = await tx.supplier.findFirst({ where: { id: data.partyId, businessId } });
    if (!supplier) throw new ApiError(404, "Supplier not found");

    if (data.purchaseId) {
      const purchase = await tx.purchase.findFirst({
        where: { id: data.purchaseId, businessId, supplierId: data.partyId },
      });
      if (!purchase) throw new ApiError(404, "Purchase not found for this supplier");
    }

    const updated = await tx.supplier.update({
      where: { id: supplier.id },
      data: { outstanding: { decrement: D(amount) } },
    });
    await tx.supplierTransaction.create({
      data: {
        businessId,
        supplierId: supplier.id,
        type: "PAYMENT_OUT",
        amount: D(amount),
        balanceAfter: updated.outstanding,
        referenceType: "PAYMENT",
        note: data.reference || "Supplier payment",
      },
    });

    const payment = await tx.payment.create({
      data: {
        businessId,
        direction: "PAID",
        partyType: data.purchaseId ? "PURCHASE" : "SUPPLIER",
        supplierId: supplier.id,
        purchaseId: data.purchaseId || null,
        amount: D(amount),
        method: data.method,
        reference: data.reference || null,
        notes: data.notes || null,
        paymentDate,
        createdById: userId,
      },
    });

    let purchaseDueLeft = null;
    if (data.purchaseId) {
      const purchase = await tx.purchase.findUnique({ where: { id: data.purchaseId } });
      const applied = Math.min(amount, Number(purchase.dueAmount));
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { paidAmount: { increment: D(applied) }, dueAmount: { decrement: D(applied) } },
      });
      purchaseDueLeft = Number(purchase.dueAmount) - applied;
    }
    return { payment, balanceAfter: updated.outstanding, purchaseDueLeft };
  });
}

async function list(businessId, { page, limit, direction, from, to, method }) {
  const where = { businessId };
  if (direction) where.direction = direction;
  if (method) where.method = method;
  const dateFilter = {};
  if (from) dateFilter.gte = from;
  if (to) dateFilter.lte = to;
  if (Object.keys(dateFilter).length) where.paymentDate = dateFilter;

  const [total, items] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
        creator: { select: { name: true } },
      },
      orderBy: { paymentDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return paginate(items, total, page, limit);
}

module.exports = { createPayment, list };
