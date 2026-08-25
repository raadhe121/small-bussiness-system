const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { parsePagination, buildMeta } = require("../utils/pagination");
const { round2, add, sub } = require("../utils/money");

/**
 * Customers & Suppliers (parties). Every query is scoped by businessId —
 * tenant isolation is enforced at the service layer.
 */

function serializeParty(p) {
  return { ...p, creditLimit: p.creditLimit?.toNumber() ?? 0, outstanding: p.outstanding.toNumber() };
}

const partyWhere = (businessId, search) => ({
  businessId,
  ...(search ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }, ...(search.length >= 3 ? [{ gstin: { contains: search } }] : [])] } : {}),
});

// ---------- Customers ----------

async function listCustomers(businessId, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = partyWhere(businessId, query.search);
  const [items, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }] }),
    prisma.customer.count({ where }),
  ]);
  return { items: items.map(serializeParty), meta: buildMeta({ page, limit }, total) };
}

async function getCustomer(businessId, id) {
  const c = await prisma.customer.findFirst({ where: { id, businessId } });
  if (!c) throw new ApiError(404, "Customer not found");
  return serializeParty(c);
}

async function createCustomer(businessId, data) {
  const dup = await prisma.customer.findUnique({ where: { businessId_phone: { businessId, phone: data.phone } } });
  if (dup) throw new ApiError(409, "A customer with this phone number already exists");
  const c = await prisma.customer.create({
    data: { ...data, email: data.email || null, businessId },
  });
  return serializeParty(c);
}

async function updateCustomer(businessId, id, data) {
  const existing = await prisma.customer.findFirst({ where: { id, businessId } });
  if (!existing) throw new ApiError(404, "Customer not found");
  if (data.phone && data.phone !== existing.phone) {
    const dup = await prisma.customer.findUnique({ where: { businessId_phone: { businessId, phone: data.phone } } });
    if (dup) throw new ApiError(409, "A customer with this phone number already exists");
  }
  const updated = await prisma.customer.update({
    where: { id },
    data: { ...data, email: data.email === undefined ? undefined : data.email || null },
  });
  return serializeParty(updated);
}

async function deleteCustomer(businessId, id) {
  const existing = await prisma.customer.findFirst({ where: { id, businessId } });
  if (!existing) throw new ApiError(404, "Customer not found");
  const sales = await prisma.sale.count({ where: { customerId: id } });
  const payments = await prisma.payment.count({ where: { customerId: id } });
  if (sales > 0 || payments > 0 || existing.outstanding.toNumber() !== 0) {
    throw new ApiError(409, "Customer has sales/payment history and cannot be deleted");
  }
  await prisma.customer.delete({ where: { id } });
}

/** Full ledger: customer profile + sales + payment history + running balance. */
async function getCustomerLedger(businessId, id) {
  const customer = await getCustomer(businessId, id);
  const [sales, payments, txns] = await Promise.all([
    prisma.sale.findMany({
      where: { businessId, customerId: id },
      orderBy: { saleDate: "desc" },
      take: 100,
      select: { id: true, invoiceNo: true, grandTotal: true, paidAmount: true, dueAmount: true, saleDate: true, paymentMethod: true },
    }),
    prisma.payment.findMany({
      where: { businessId, customerId: id },
      orderBy: { paymentDate: "desc" },
      take: 100,
    }),
    prisma.customerTransaction.findMany({
      where: { businessId, customerId: id },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);
  return {
    customer,
    sales,
    payments,
    ledger: txns.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount.toNumber(),
      balanceAfter: t.balanceAfter.toNumber(),
      note: t.note,
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      date: t.createdAt,
    })),
    summary: {
      totalSales: sales.reduce((s, x) => add(s, x.grandTotal.toNumber()), 0),
      totalPaid: sales.reduce((s, x) => add(s, x.paidAmount.toNumber()), 0),
      outstanding: customer.outstanding,
    },
  };
}

// ---------- Suppliers ----------

async function listSuppliers(businessId, query) {
  const { page, limit, skip, take } = parsePagination(query);
  const where = partyWhere(businessId, query.search);
  const [items, total] = await Promise.all([
    prisma.supplier.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }] }),
    prisma.supplier.count({ where }),
  ]);
  return { items: items.map((s) => ({ ...s, outstanding: s.outstanding.toNumber() })), meta: buildMeta({ page, limit }, total) };
}

async function getSupplier(businessId, id) {
  const s = await prisma.supplier.findFirst({ where: { id, businessId } });
  if (!s) throw new ApiError(404, "Supplier not found");
  return { ...s, outstanding: s.outstanding.toNumber() };
}

async function createSupplier(businessId, data) {
  const dup = await prisma.supplier.findUnique({ where: { businessId_phone: { businessId, phone: data.phone } } });
  if (dup) throw new ApiError(409, "A supplier with this phone number already exists");
  const s = await prisma.supplier.create({
    data: { ...data, email: data.email || null, businessId },
  });
  return { ...s, outstanding: s.outstanding.toNumber() };
}

async function updateSupplier(businessId, id, data) {
  const existing = await prisma.supplier.findFirst({ where: { id, businessId } });
  if (!existing) throw new ApiError(404, "Supplier not found");
  if (data.phone && data.phone !== existing.phone) {
    const dup = await prisma.supplier.findUnique({ where: { businessId_phone: { businessId, phone: data.phone } } });
    if (dup) throw new ApiError(409, "A supplier with this phone number already exists");
  }
  const updated = await prisma.supplier.update({
    where: { id },
    data: { ...data, email: data.email === undefined ? undefined : data.email || null },
  });
  return { ...updated, outstanding: updated.outstanding.toNumber() };
}

async function deleteSupplier(businessId, id) {
  const existing = await prisma.supplier.findFirst({ where: { id, businessId } });
  if (!existing) throw new ApiError(404, "Supplier not found");
  const purchases = await prisma.purchase.count({ where: { supplierId: id } });
  const payments = await prisma.payment.count({ where: { supplierId: id } });
  if (purchases > 0 || payments > 0 || existing.outstanding.toNumber() !== 0) {
    throw new ApiError(409, "Supplier has purchase/payment history and cannot be deleted");
  }
  await prisma.supplier.delete({ where: { id } });
}

async function getSupplierLedger(businessId, id) {
  const supplier = await getSupplier(businessId, id);
  const [purchases, payments, txns] = await Promise.all([
    prisma.purchase.findMany({
      where: { businessId, supplierId: id },
      orderBy: { purchaseDate: "desc" },
      take: 100,
      select: { id: true, billNo: true, grandTotal: true, paidAmount: true, dueAmount: true, purchaseDate: true, paymentMethod: true },
    }),
    prisma.payment.findMany({
      where: { businessId, supplierId: id },
      orderBy: { paymentDate: "desc" },
      take: 100,
    }),
    prisma.supplierTransaction.findMany({
      where: { businessId, supplierId: id },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);
  return {
    supplier,
    purchases,
    payments,
    ledger: txns.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount.toNumber(),
      balanceAfter: t.balanceAfter.toNumber(),
      note: t.note,
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      date: t.createdAt,
    })),
    summary: {
      totalPurchases: purchases.reduce((s, x) => add(s, x.grandTotal.toNumber()), 0),
      totalPaid: purchases.reduce((s, x) => add(s, x.paidAmount.toNumber()), 0),
      outstanding: supplier.outstanding,
    },
  };
}

module.exports = {
  listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerLedger,
  listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier, getSupplierLedger,
};
