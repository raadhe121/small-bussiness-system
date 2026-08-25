import { useRef } from "react";
import { PageSkeleton } from "../components/Skeleton";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer, Share2 } from "lucide-react";
import api from "../services/api";
import useFetch from "../hooks/useFetch";
import EmptyState from "../components/EmptyState";
import { useToast } from "../context/ToastContext";
import { inr, fmtDate, titleCase } from "../utils/format";

export default function InvoiceView() {
  const { saleId } = useParams();
  const printRef = useRef(null);
  const toast = useToast();
  const { data, loading, error } = useFetch(
    () => api.get(`/invoices/${saleId}`).then((r) => r.data.data),
    [saleId]
  );

  if (loading) return <PageSkeleton />;
  if (error || !data) return <EmptyState title="Invoice not found" action={<Link className="btn-secondary" to="/invoices">Back to invoices</Link>} />;

  const { invoice: s, business: b, payments } = data;
  const isInterState = s.isInterState;

  const share = async () => {
    const url = window.location.href;
    const text = `Invoice ${s.invoiceNo} — ${b.name} — Total ${inr(s.grandTotal)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Invoice ${s.invoiceNo}`, text, url });
      } catch {}
    } else {
      // WhatsApp share link — common in Indian retail
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 no-print">
        <Link to="/invoices" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600">
          <ArrowLeft className="w-4 h-4" /> All invoices
        </Link>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={share}><Share2 className="w-4 h-4" /> Share</button>
          <button className="btn-primary" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print / Save PDF</button>
        </div>
      </div>

      {/* Invoice sheet */}
      <div ref={printRef} id="print-area" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{b?.name}</h1>
            <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">
              {[b?.address, b?.city, b?.state, b?.pincode].filter(Boolean).join(", ")}
              {b?.phone && `\nPhone: ${b.phone}`}
              {b?.email && ` · ${b.email}`}
            </p>
            {b?.gstin && <p className="text-xs font-mono mt-1 text-slate-600">GSTIN: {b.gstin}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-extrabold tracking-tight text-brand-700 uppercase">Tax Invoice</p>
            <p className="text-sm mt-2"><span className="font-semibold">Invoice:</span> {s.invoiceNo}</p>
            <p className="text-sm"><span className="font-semibold">Date:</span> {fmtDate(s.saleDate)}</p>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-5 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Bill To</p>
            {s.customer ? (
              <>
                <p className="font-semibold text-slate-800">{s.customer.name}</p>
                <p className="text-sm text-slate-500">{[s.customer.address, s.customer.city, s.customer.state].filter(Boolean).join(", ")}</p>
                <p className="text-sm text-slate-500">{s.customer.phone}</p>
                {s.customer.gstin && <p className="text-xs font-mono text-slate-600">GSTIN: {s.customer.gstin}</p>}
              </>
            ) : (
              <p className="text-slate-500">Walk-in customer</p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Payment</p>
            <p className="text-sm"><span className="font-medium">Method:</span> {titleCase(s.paymentMethod)}</p>
            <p className={`text-sm font-semibold ${s.dueAmount > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {s.dueAmount > 0 ? `Balance due: ${inr(s.dueAmount)}` : "PAID IN FULL"}
            </p>
          </div>
        </div>

        {/* Items */}
        <table className="w-full mt-2 text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-400">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Rate</th>
              <th className="py-2 pr-2 text-right">Disc</th>
              <th className="py-2 pr-2 text-right">GST {isInterState ? "" : ""}</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {s.items.map((it, i) => (
              <tr key={it.id}>
                <td className="py-2.5 pr-2 text-slate-400">{i + 1}</td>
                <td className="py-2.5 pr-2 font-medium text-slate-700">{it.productName}</td>
                <td className="py-2.5 pr-2 text-right">{Number(it.quantity)}</td>
                <td className="py-2.5 pr-2 text-right">{inr(it.rate)}</td>
                <td className="py-2.5 pr-2 text-right">{Number(it.discount) ? inr(it.discount) : "—"}</td>
                <td className="py-2.5 pr-2 text-right text-slate-500">{Number(it.taxRate)}%</td>
                <td className="py-2.5 text-right font-medium">{inr(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <div className="w-full sm:w-72 space-y-1.5 text-sm">
            <Row label="Subtotal" value={inr(s.subtotal)} />
            {Number(s.discount) > 0 && <Row label="Discount" value={`− ${inr(s.discount)}`} />}
            {!isInterState ? (
              <>
                <Row label="CGST" value={inr(s.cgst)} />
                <Row label="SGST" value={inr(s.sgst)} />
              </>
            ) : (
              <Row label="IGST" value={inr(s.igst)} />
            )}
            <div className="border-t border-slate-300 pt-2 flex justify-between font-bold text-base text-slate-800">
              <span>Grand Total</span><span>{inr(s.grandTotal)}</span>
            </div>
            <Row label="Paid" value={inr(s.paidAmount)} />
            {s.dueAmount > 0 && <Row label="Balance Due" value={inr(s.dueAmount)} tone="text-red-600" bold />}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-5 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          {payments.length > 0 && (
            <p><span className="font-semibold">Payments received:</span>{" "}
              {payments.map((p) => `${inr(p.amount)} (${String(p.method).replace("_", " ")}${p.reference ? `, ${p.reference}` : ""})`).join("; ")}
            </p>
          )}
          {b?.upiId && <p>Pay via UPI: <b>{b.upiId}</b></p>}
          {b?.bankDetails && <p className="whitespace-pre-line">{b.bankDetails}</p>}
          {b?.invoiceTerms && <p className="whitespace-pre-line pt-1">{b.invoiceTerms}</p>}
          <p className="pt-1 text-center text-slate-400">This is a computer-generated invoice.</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone, bold }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${tone || "text-slate-700"}`}>{value}</span>
    </div>
  );
}
