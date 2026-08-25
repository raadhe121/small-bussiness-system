const prisma = require("../config/prisma");

/**
 * GST reporting (India). Computes output tax (CGST/SGST/IGST) from sales,
 * input tax credit from purchases, and a rate-wise summary — the numbers an
 * accountant needs to prepare GSTR filings manually or via an authorised
 * GST filing API. No official filing integration is performed here.
 */
async function gstSummary(businessId, from, to) {
  const saleDate = {};
  if (from) saleDate.gte = from;
  if (to) saleDate.lte = to;

  const [salesAgg, purchaseAgg, rateRows, b2bCount] = await Promise.all([
    prisma.sale.aggregate({
      where: { businessId, ...(Object.keys(saleDate).length ? { saleDate } : {}) },
      _sum: { subtotal: true, cgst: true, sgst: true, igst: true, totalTax: true, grandTotal: true },
      _count: true,
    }),
    prisma.purchase.aggregate({
      where: { businessId, ...(Object.keys(saleDate).length ? { purchaseDate: saleDate } : {}) },
      _sum: { totalTax: true, grandTotal: true },
      _count: true,
    }),
    prisma.saleItem.groupBy({
      by: ["taxRate"],
      where: {
        taxRate: { gt: 0 },
        ...(Object.keys(saleDate).length
          ? { sale: { businessId, saleDate } }
          : { sale: { businessId } }),
      },
      _sum: { taxable: true, taxAmount: true },
    }),
    prisma.sale.count({
      where: {
        businessId,
        isInterState: false,
        ...(Object.keys(saleDate).length ? { saleDate } : {}),
      },
    }),
  ]);

  const outputTax =
    Number(salesAgg._sum.cgst || 0) +
    Number(salesAgg._sum.sgst || 0) +
    Number(salesAgg._sum.igst || 0);
  const inputTax = Number(purchaseAgg._sum.totalTax || 0);

  return {
    period: { from: from || null, to: to || null },
    output: {
      invoices: salesAgg._count,
      taxableValue: salesAgg._sum.subtotal || 0,
      cgst: salesAgg._sum.cgst || 0,
      sgst: salesAgg._sum.sgst || 0,
      igst: salesAgg._sum.igst || 0,
      totalTax: salesAgg._sum.totalTax || 0,
      invoiceValue: salesAgg._sum.grandTotal || 0,
    },
    input: {
      bills: purchaseAgg._count,
      inputTaxCredit: purchaseAgg._sum.totalTax || 0,
      invoiceValue: purchaseAgg._sum.grandTotal || 0,
    },
    netPayable: Math.round((outputTax - inputTax) * 100) / 100,
    rateWise: rateRows
      .map((r) => ({
        taxRate: r.taxRate,
        taxableValue: r._sum.taxable || 0,
        taxAmount: r._sum.taxAmount || 0,
      }))
      .sort((a, b) => Number(a.taxRate) - Number(b.taxRate)),
  };
}

module.exports = { gstSummary };
