const prisma = require("../config/prisma");

/** Global search across products, customers, suppliers and sales invoices. */
async function globalSearch(businessId, term) {
  const q = term.trim();
  if (q.length < 2) return { products: [], customers: [], suppliers: [], invoices: [] };
  const contains = { contains: q };

  const [products, customers, suppliers, invoices] = await Promise.all([
    prisma.product.findMany({
      where: { businessId, OR: [{ name: contains }, { sku: contains }, ...(q.length >= 6 ? [{ barcode: contains }] : [])] },
      select: { id: true, name: true, sku: true, sellingPrice: true, currentStock: true, unit: true },
      take: 6,
    }),
    prisma.customer.findMany({
      where: { businessId, OR: [{ name: contains }, { phone: contains }] },
      select: { id: true, name: true, phone: true, outstanding: true },
      take: 6,
    }),
    prisma.supplier.findMany({
      where: { businessId, OR: [{ name: contains }, { phone: contains }] },
      select: { id: true, name: true, phone: true, outstanding: true },
      take: 6,
    }),
    prisma.sale.findMany({
      where: { businessId, invoiceNo: contains },
      select: { id: true, invoiceNo: true, grandTotal: true, saleDate: true, customer: { select: { name: true } } },
      orderBy: { saleDate: "desc" },
      take: 6,
    }),
  ]);

  return {
    products: products.map((p) => ({ ...p, sellingPrice: p.sellingPrice.toNumber(), currentStock: p.currentStock.toNumber() })),
    customers: customers.map((c) => ({ ...c, outstanding: c.outstanding.toNumber() })),
    suppliers: suppliers.map((s) => ({ ...s, outstanding: s.outstanding.toNumber() })),
    invoices: invoices.map((i) => ({ ...i, grandTotal: i.grandTotal.toNumber(), customerName: i.customer?.name || "Walk-in" })),
  };
}

module.exports = { globalSearch };
