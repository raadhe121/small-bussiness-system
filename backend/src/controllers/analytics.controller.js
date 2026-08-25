const analytics = require("../services/analytics.service");
const notifications = require("../services/notification.service");
const searchService = require("../services/search.service");
const salesService = require("../services/sales.service");
const prisma = require("../config/prisma");
const { ok } = require("../utils/response");
const { getRange } = require("../validations/dateRange.schema");

// ---- Dashboard ----

async function dashboard(req, res, next) {
  try { ok(res, await analytics.getDashboard(req.user.businessId)); }
  catch (err) { next(err); }
}

// ---- Reports ----

async function salesReport(req, res, next) {
  try { ok(res, await analytics.salesReport(req.user.businessId, getRange(req.validatedQuery))); }
  catch (err) { next(err); }
}

async function purchaseReport(req, res, next) {
  try { ok(res, await analytics.purchaseReport(req.user.businessId, getRange(req.validatedQuery))); }
  catch (err) { next(err); }
}

async function profitReport(req, res, next) {
  try { ok(res, await analytics.profitReport(req.user.businessId, getRange(req.validatedQuery))); }
  catch (err) { next(err); }
}

async function expenseReport(req, res, next) {
  try { ok(res, await analytics.expenseReport(req.user.businessId, getRange(req.validatedQuery))); }
  catch (err) { next(err); }
}

async function inventoryReport(req, res, next) {
  try { ok(res, await analytics.inventoryReport(req.user.businessId)); }
  catch (err) { next(err); }
}

async function outstandingReport(req, res, next) {
  try { ok(res, await analytics.outstandingReport(req.user.businessId)); }
  catch (err) { next(err); }
}

async function paymentReport(req, res, next) {
  try { ok(res, await analytics.paymentReport(req.user.businessId, getRange(req.validatedQuery))); }
  catch (err) { next(err); }
}

// ---- GST ----

async function gstSummary(req, res, next) {
  try { ok(res, await analytics.gstSummary(req.user.businessId, getRange(req.validatedQuery))); }
  catch (err) { next(err); }
}

// ---- Search / Notifications / Invoices ----

async function globalSearch(req, res, next) {
  try { ok(res, await searchService.globalSearch(req.user.businessId, String(req.query.q || ""))); }
  catch (err) { next(err); }
}

async function listNotifications(req, res, next) {
  try { ok(res, await notifications.listNotifications(req.user.businessId, req.query)); }
  catch (err) { next(err); }
}

async function markNotificationRead(req, res, next) {
  try { await notifications.markRead(req.user.businessId, req.params.id); ok(res, null, "Marked as read"); }
  catch (err) { next(err); }
}

async function markAllNotificationsRead(req, res, next) {
  try { await notifications.markAllRead(req.user.businessId); ok(res, null, "All notifications marked as read"); }
  catch (err) { next(err); }
}

/** Invoice data for rendering/printing — sale + business profile in one payload. */
async function getInvoiceData(req, res, next) {
  try {
    const sale = await salesService.getSale(req.user.businessId, req.params.saleId);
    const business = await prisma.business.findUnique({
      where: { id: req.user.businessId },
      select: {
        name: true, ownerName: true, phone: true, email: true, address: true,
        city: true, state: true, pincode: true, gstin: true, logoUrl: true,
        invoiceTerms: true, upiId: true, bankDetails: true,
      },
    });
    const payments = await prisma.payment.findMany({
      where: { businessId: req.user.businessId, saleId: sale.id },
      orderBy: { paymentDate: "asc" },
    });
    ok(res, {
      invoice: sale,
      business,
      payments: payments.map((p) => ({ id: p.id, amount: p.amount.toNumber(), method: p.method, reference: p.reference, date: p.paymentDate })),
    });
  } catch (err) { next(err); }
}

module.exports = {
  dashboard,
  salesReport, purchaseReport, profitReport, expenseReport,
  inventoryReport, outstandingReport, paymentReport,
  gstSummary,
  globalSearch,
  listNotifications, markNotificationRead, markAllNotificationsRead,
  getInvoiceData,
};
