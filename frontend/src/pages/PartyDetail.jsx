import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Wallet, Phone, Mail, MapPin, FileText } from "lucide-react";
import api, { errMsg } from "../services/api";
import { submitOrQueue } from "../services/offlineQueue";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { inr, fmtDate, titleCase } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

const METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER"];

/** Shared detail page: profile + ledger + history + record payment. */
export default function PartyDetail({ mode }) {
  const isCustomer = mode === "customer";
  const base = isCustomer ? "/customers" : "/suppliers";
  const label = isCustomer ? "Customer" : "Supplier";
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const canPay = hasPermission(user?.role, "payments:create");

  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", method: "CASH", reference: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const { data, loading, error, refetch } = useFetch(
    () => api.get(`${base}/${id}/ledger`).then((r) => r.data.data),
    [id, mode]
  );

  if (loading) return <Spinner className="block mx-auto my-16" />;
  if (error || !data)
    return <EmptyState title={`${label} not found`} action={<Link className="btn-secondary" to={base}>Back</Link>} />;

  const { customer, supplier } = data;
  const party = isCustomer ? customer : supplier;

  const recordPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await submitOrQueue({
        label: "Payment",
        url: `/payments/${isCustomer ? "customer" : "supplier"}`,
        method: "POST",
        body: {
          ...(isCustomer ? { customerId: id } : { supplierId: id }),
          amount: Number(payForm.amount),
          method: payForm.method,
          reference: payForm.reference || undefined,
          notes: payForm.notes || undefined,
        },
      });
      toast.success(result.queued ? "Payment queued — will sync" : "Payment recorded");
      setPayOpen(false);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Link to={base} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> All {label.toLowerCase()}s
      </Link>

      <div className="card p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{party.name}</h1>
            <div className="mt-2 space-y-1 text-sm text-slate-500">
              <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {party.phone}</p>
              {party.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {party.email}</p>}
              {(party.address || party.city) && (
                <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {[party.address, party.city, party.state].filter(Boolean).join(", ")}</p>
              )}
              {party.gstin && <p className="text-xs font-mono">GSTIN: {party.gstin}</p>}
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className={`rounded-xl px-5 py-3 ${Number(party.outstanding) > 0 ? (isCustomer ? "bg-emerald-50" : "bg-red-50") : "bg-slate-50"}`}>
              <p className="text-xs text-slate-500">{isCustomer ? "To collect" : "To pay"}</p>
              <p className={`text-2xl font-bold ${Number(party.outstanding) > 0 ? (isCustomer ? "text-emerald-600" : "text-red-600") : "text-slate-400"}`}>
                {inr(party.outstanding)}
              </p>
            </div>
            {canPay && Number(party.outstanding) > 0 && (
              <button
                className="btn-primary w-full sm:w-auto"
                onClick={() => {
                  setPayForm({ amount: String(Number(party.outstanding)), method: "CASH", reference: "", notes: "" });
                  setPayOpen(true);
                }}
              >
                <Wallet className="w-4 h-4" /> Record payment
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
          <Summary label={isCustomer ? "Total sales" : "Total purchases"} value={inr(isCustomer ? data.summary.totalSales : data.summary.totalPurchases)} />
          <Summary label="Total paid" value={inr(data.summary.totalPaid)} />
          {isCustomer && <Summary label="Credit limit" value={inr(party.creditLimit)} />}
        </div>
      </div>

      {/* Ledger */}
      <div className="card overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-sm">Ledger</h2>
        </div>
        {data.ledger.length === 0 ? (
          <EmptyState icon={FileText} title="No transactions yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Type</th>
                  <th className="th">Note</th>
                  <th className="th text-right">Amount</th>
                  <th className="th text-right">Balance after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...data.ledger].reverse().map((t) => (
                  <tr key={t.id}>
                    <td className="td">{fmtDate(t.date)}</td>
                    <td className="td"><span className={`badge ${t.type.includes("PAYMENT") || t.type === "PAYMENT_IN" || t.type === "PAYMENT_OUT" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{titleCase(t.type)}</span></td>
                    <td className="td text-slate-500 max-w-xs truncate">{t.note || t.referenceType || "—"}</td>
                    <td className={`td text-right font-medium ${["INVOICE", "PURCHASE"].includes(t.type) === isCustomer ? "" : ""}`}>{inr(t.amount)}</td>
                    <td className="td text-right">{inr(t.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-sm">{isCustomer ? "Sales history" : "Purchase history"}</h2>
        </div>
        {(isCustomer ? data.sales : data.purchases).length === 0 ? (
          <EmptyState title="No records" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="th">#</th>
                  <th className="th">Date</th>
                  <th className="th">Method</th>
                  <th className="th text-right">Total</th>
                  <th className="th text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(isCustomer ? data.sales : data.purchases).map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="td font-medium">{isCustomer ? s.invoiceNo : s.billNo || "—"}</td>
                    <td className="td">{fmtDate(isCustomer ? s.saleDate : s.purchaseDate)}</td>
                    <td className="td text-slate-500">{titleCase(s.paymentMethod)}</td>
                    <td className="td text-right font-semibold">{inr(s.grandTotal)}</td>
                    <td className={`td text-right ${Number(s.dueAmount) > 0 ? "text-red-500 font-medium" : "text-slate-400"}`}>{inr(s.dueAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={`Record payment from ${party.name}`}>
        <form onSubmit={recordPayment} className="space-y-4">
          <div>
            <label className="label">Amount (₹) — max {inr(party.outstanding)}</label>
            <input required type="number" min="0.01" max={Number(party.outstanding)} step="0.01" className="input" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              {METHODS.map((m) => <option key={m}>{m.replace("_", " ")}</option>).concat(<option key="OTHER">{isCustomer ? "OTHER" : "OTHER"}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Reference</label>
            <input className="input" placeholder="UPI txn id / cheque no." value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setPayOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save payment"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-bold text-slate-800">{value}</p>
    </div>
  );
}
