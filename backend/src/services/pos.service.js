const { Prisma } = require("@prisma/client");
const prisma = require("../config/prisma");
const { ApiError } = require("../utils/response");
const { round2 } = require("../utils/money");

/**
 * POS "parked" / held bills.
 *
 * A cashier can set a half-built bill aside and pull it back later (another
 * customer walks up, the first one forgets their wallet, a second register
 * opens, etc.). The cart — product ids, quantities, rates, manual discounts —
 * is stored as JSON so it can be rebuilt exactly without re-locking stock.
 * Resuming is a pure client-side action that repopulates the cart from this
 * payload; completing it then runs the normal sale flow.
 */

function serializeHeldBill(b) {
  const num = (v) => (v && typeof v.toNumber === "function" ? v.toNumber() : Number(v || 0));
  return {
    ...b,
    discount: num(b.discount),
    total: num(b.total),
    items: Array.isArray(b.items) ? b.items : [],
  };
}

async function holdBill(user, data) {
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new ApiError(400, "A held bill must contain at least one item");
  }

  const items = data.items.map((it) => ({
    productId: it.productId,
    name: it.name,
    unit: it.unit || "",
    quantity: Number(it.quantity),
    rate: Number(it.rate),
    discount: Number(it.discount || 0),
    taxRate: Number(it.taxRate || 0),
  }));

  const name = (data.name && data.name.trim()) ||
    `Bill ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;

  const bill = await prisma.heldBill.create({
    data: {
      businessId: user.businessId,
      name: name.slice(0, 120),
      customerId: data.customerId || null,
      customerName: data.customerName || null,
      items,
      paymentMethod: data.paymentMethod || "CASH",
      discount: new Prisma.Decimal(String(round2(Number(data.discount || 0)))),
      notes: data.notes || null,
      total: new Prisma.Decimal(String(round2(Number(data.total || 0)))),
      createdById: user.id,
    },
  });
  return serializeHeldBill(bill);
}

async function listHeldBills(businessId) {
  const items = await prisma.heldBill.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });
  return { items: items.map(serializeHeldBill) };
}

async function getHeldBill(businessId, id) {
  const bill = await prisma.heldBill.findFirst({ where: { id, businessId } });
  if (!bill) throw new ApiError(404, "Held bill not found");
  return serializeHeldBill(bill);
}

async function deleteHeldBill(businessId, id) {
  const bill = await prisma.heldBill.findFirst({ where: { id, businessId } });
  if (!bill) throw new ApiError(404, "Held bill not found");
  await prisma.heldBill.delete({ where: { id } });
  return { id };
}

module.exports = { holdBill, listHeldBills, getHeldBill, deleteHeldBill };
