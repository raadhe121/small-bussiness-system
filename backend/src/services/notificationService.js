const prisma = require("../config/prisma");

/**
 * Notification engine. refreshAlerts() scans business data and creates
 * deduplicated notifications for low stock / customer dues / supplier dues,
 * respecting the business's notification settings. Called when notifications
 * are fetched (and from the dashboard) so alerts stay fresh without a cron.
 */

const DEDUP_WINDOW_MS = 12 * 3600 * 1000;

async function createDeduped(tx, { businessId, type, title, message, link }) {
  const recent = await tx.notification.findFirst({
    where: {
      businessId, type, link: link || null,
      createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (recent) return null;
  return tx.notification.create({ data: { businessId, type, title, message, link } });
}

async function refreshAlerts(businessId) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { lowStockAlertsEnabled: true, paymentDueAlertsEnabled: true },
  });
  if (!business) return;
  const created = [];

  if (business.lowStockAlertsEnabled) {
    const low = await prisma.product.findMany({
      where: { businessId, status: "ACTIVE", currentStock: { lte: prisma.product.fields.minStock } },
      select: { id: true, name: true, currentStock: true, minStock: true, unit: true },
      take: 10,
      orderBy: { currentStock: "asc" },
    });
    for (const p of low) {
      const n = await createDeduped(prisma, {
        businessId,
        type: "LOW_STOCK",
        title: `Low stock: ${p.name}`,
        message: `Only ${Number(p.currentStock)} ${p.unit} left (minimum ${Number(p.minStock)}).`,
        link: "/inventory",
      });
      if (n) created.push(n);
    }
  }

  if (business.paymentDueAlertsEnabled) {
    const dueCustomers = await prisma.customer.aggregate({
      where: { businessId, outstanding: { gt: 0 } },
      _count: true, _sum: { outstanding: true },
    });
    if (dueCustomers._count > 0) {
      const n = await createDeduped(prisma, {
        businessId,
        type: "CUSTOMER_DUE",
        title: `${dueCustomers._count} customer${dueCustomers._count > 1 ? "s" : ""} owe you money`,
        message: `Total receivable ₹${dueCustomers._sum.outstanding}.`,
        link: "/reports?tab=receivables",
      });
      if (n) created.push(n);
    }
    const dueSuppliers = await prisma.supplier.aggregate({
      where: { businessId, outstanding: { gt: 0 } },
      _count: true, _sum: { outstanding: true },
    });
    if (dueSuppliers._count > 0) {
      const n = await createDeduped(prisma, {
        businessId,
        type: "SUPPLIER_DUE",
        title: `You owe ${dueSuppliers._count} supplier${dueSuppliers._count > 1 ? "s" : ""}`,
        message: `Total payable ₹${dueSuppliers._sum.outstanding}.`,
        link: "/reports?tab=payables",
      });
      if (n) created.push(n);
    }
  }
  return created;
}

async function list(businessId, { unreadOnly }) {
  await refreshAlerts(businessId);
  return prisma.notification.findMany({
    where: { businessId, ...(unreadOnly === "true" ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

async function unreadCount(businessId) {
  return prisma.notification.count({ where: { businessId, isRead: false } });
}

async function markRead(businessId, id) {
  await prisma.notification.updateMany({ where: { id, businessId }, data: { isRead: true } });
  return { ok: true };
}

async function markAllRead(businessId) {
  await prisma.notification.updateMany({ where: { businessId, isRead: false }, data: { isRead: true } });
  return { ok: true };
}

module.exports = { list, unreadCount, markRead, markAllRead };
