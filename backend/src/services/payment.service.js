const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { resolveReadScope, resolveWriteBranch } = require("../utils/branchScope");

/**
 * Payments service.
 * Customer payments (PAYMENT_IN) reduce customer outstanding.
 * Supplier payments (PAYMENT_OUT) reduce supplier outstanding.
 * Every payment writes a party ledger transaction atomically.
 */

function serializePayment(p) {
  return {
    ...p,
    amount: p.amount.toNumber(),
    branchId: p.branchId ?? null,
    branchName: p.branch?.name ?? null,
  };
}

async function listPayments(scope, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = {
    businessId: scope.businessId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(query.partyType ? { partyType: query.partyType } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.from || query.to ? { paymentDate: { gte: new Date(query.from), lte: query.to ? new Date(query.to) : undefined } } : {}),
  };
  const [items, total, agg] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { paymentDate: "desc" },
      include: {
        customer: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where, _sum: { amount: true } }),
  ]);
  return {
    items: items.map(serializePayment),
    meta: buildMeta({ page, limit }, total),
    summary: { totalAmount: agg._sum.amount?.toNumber() || 0 },
  };
}

async function createCustomerPayment(user, data) {
  const scope = resolveWriteBranch(user, data);
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: data.customerId, businessId: user.businessId },
    });
    if (!customer) throw new ApiError(404, "Customer not found");
    if (customer.outstanding.lte(0)) throw new ApiError(400, "This customer has no outstanding balance");

    // Never accept more than what is owed.
    const amount = Prisma.Decimal.min(new Prisma.Decimal(String(data.amount)), customer.outstanding);

    await tx.customer.update({
      where: { id: customer.id },
      data: { outstanding: { decrement: amount } },
    });
    const updated = await tx.customer.findUnique({ where: { id: customer.id }, select: { outstanding: true } });

    const payment = await tx.payment.create({
      data: {
        businessId: user.businessId,
        branchId: scope.branchId,
        direction: "RECEIVED",
        partyType: "CUSTOMER",
        customerId: customer.id,
        amount,
        method: data.method,
        reference: data.reference || null,
        notes: data.notes || null,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        createdById: user.id,
      },
    });
    await tx.customerTransaction.create({
      data: {
        businessId: user.businessId,
        customerId: customer.id,
        type: "PAYMENT_IN",
        amount,
        balanceAfter: updated.outstanding,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        note: data.notes || `Payment received via ${data.method}`,
      },
    });
    return serializePayment(payment);
  });
}

async function createSupplierPayment(user, data) {
  const scope = resolveWriteBranch(user, data);
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: data.supplierId, businessId: user.businessId },
    });
    if (!supplier) throw new ApiError(404, "Supplier not found");
    if (supplier.outstanding.lte(0)) throw new ApiError(400, "This supplier has no outstanding balance");

    const amount = Prisma.Decimal.min(new Prisma.Decimal(String(data.amount)), supplier.outstanding);

    await tx.supplier.update({
      where: { id: supplier.id },
      data: { outstanding: { decrement: amount } },
    });
    const updated = await tx.supplier.findUnique({ where: { id: supplier.id }, select: { outstanding: true } });

    const payment = await tx.payment.create({
      data: {
        businessId: user.businessId,
        branchId: scope.branchId,
        direction: "PAID",
        partyType: "SUPPLIER",
        supplierId: supplier.id,
        amount,
        method: data.method,
        reference: data.reference || null,
        notes: data.notes || null,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        createdById: user.id,
      },
    });
    await tx.supplierTransaction.create({
      data: {
        businessId: user.businessId,
        supplierId: supplier.id,
        type: "PAYMENT_OUT",
        amount,
        balanceAfter: updated.outstanding,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        note: data.notes || `Payment made via ${data.method}`,
      },
    });
    return serializePayment(payment);
  });
}

module.exports = { listPayments, createCustomerPayment, createSupplierPayment, serializePayment };
