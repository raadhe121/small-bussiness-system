const prisma = require("../config/prisma");
const { parsePagination, buildMeta } = require("../utils/pagination");

/**
 * Notifications. Alerts are generated on demand by scanning business state:
 *  - LOW_STOCK: active products at/below minimum
 *  - CUSTOMER_DUE / SUPPLIER_DUE: parties with outstanding balances
 * Duplicate unread alerts for the same entity are suppressed via `link`.
 */

async function generateAlerts(businessId) {
  const [business, lowStock, dueCustomers, dueSuppliers] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { lowStockAlertsEnabled: true, paymentDueAlertsEnabled: true },
    }),
    prisma.product.findMany({
      where: { businessId, status: "ACTIVE", currentStock: { lte: prisma.product.fields.minStock } },
      select: { id: true, name: true, sku: true, unit: true, currentStock: true, minStock: true },
      take: 25,
    }),
    prisma.customer.findMany({
      where: { businessId, outstanding: { gt: 0 }, creditLimit: { gt: 0 }, OR: [{ isActive: true }] },
      select: { id: true, name: true, outstanding: true, creditLimit: true },
      take: 15,
    }),
    prisma.supplier.findMany({
      where: { businessId, outstanding: { gt: 0 } },
      select: { id: true, name: true, outstanding: true },
      take: 15,
    }),
  ]);

  const creates = [];

  if (business?.lowStockAlertsEnabled) {
    for (const p of lowStock) {
      const link = `/products/${p.id}`;
      const exists = await prisma.notification.findFirst({ where: { businessId, type: "LOW_STOCK", link, isRead: false } });
      if (!exists) {
        creates.push({
          businessId,
          type: "LOW_STOCK",
          title: p.currentStock.lte(0) ? `Out of stock: ${p.name}` : `Low stock: ${p.name}`,
          message: p.currentStock.lte(0)
            ? `${p.name} (${p.sku}) is out of stock.`
            : `${p.name} (${p.sku}) has ${p.currentStock.toNumber()} ${p.unit} left.`,
          link,
        });
      }
    }
  }

  if (business?.paymentDueAlertsEnabled) {
    for (const c of dueCustomers) {
      if (c.outstanding.lte(c.creditLimit)) continue;
      const link = `/customers/${c.id}`;
      const exists = await prisma.notification.findFirst({ where: { businessId, type: "CUSTOMER_DUE", link, isRead: false } });
      if (!exists) {
        creates.push({
          businessId,
          type: "CUSTOMER_DUE",
          title: `Credit limit exceeded: ${c.name}`,
          message: `${c.name} owes ₹${c.outstanding.toNumber()} (limit ₹${c.creditLimit.toNumber()}).`,
          link,
        });
      }
    }
    for (const s of dueSuppliers) {
      const link = `/suppliers/${s.id}`;
      const exists = await prisma.notification.findFirst({ where: { businessId, type: "SUPPLIER_DUE", link, isRead: false } });
      if (!exists) {
        creates.push({
          businessId,
          type: "SUPPLIER_DUE",
          title: `Payment pending to ${s.name}`,
          message: `Outstanding payable to ${s.name}: ₹${s.outstanding.toNumber()}.`,
          link,
        });
      }
    }
  }

  if (creates.length) await prisma.notification.createMany({ data: creates });
}

async function listNotifications(businessId, query) {
  await generateAlerts(businessId);
  const { page, limit, skip, take } = parsePagination(query);
  const where = { businessId };
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { businessId, isRead: false } }),
  ]);
  return { items, meta: buildMeta({ page, limit }, total), unreadCount: unread };
}

async function markRead(businessId, id) {
  await prisma.notification.updateMany({ where: { id, businessId }, data: { isRead: true } });
}

async function markAllRead(businessId) {
  await prisma.notification.updateMany({ where: { businessId, isRead: false }, data: { isRead: true } });
}

module.exports = { listNotifications, markRead, markAllRead, generateAlerts };
