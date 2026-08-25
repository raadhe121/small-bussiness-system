import { useState } from "react";
import { PageSkeleton } from "../components/Skeleton";
import { useParams, useNavigate, Link } from "react-router-dom";
import { RotateCcw, ArrowLeft } from "lucide-react";
import api, { errMsg } from "../services/api";
import { submitOrQueue } from "../services/offlineQueue";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import { inr, titleCase, fmtDate } from "../utils/format";

const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"];

export default function SalesReturn() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: sale, loading, refetch } = useFetch(
    () => api.get(`/sales/${id}`).then((r) => r.data.data),
    [id]
  );
  const [returns, setReturns] = useState({}); // saleItemId -> qty
  const [method, setMethod] = useState("CASH");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  const setQty = (saleItemId, qty) =>
    setReturns((prev) => ({ ...prev, [saleItemId]: Math.max(0, Number(qty) || 0) }));

  const totalReturnQty = Object.values(returns).reduce((a, b) => a + (Number(b) || 0), 0);

  const submit = async () => {
    if (totalReturnQty === 0) return toast.error("Enter a quantity to return for at least one item");
    const items = Object.entries(returns)
      .filter(([, q]) => Number(q) > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity: Number(quantity) }));

    setSaving(true);
    try {
      const result = await submitOrQueue({ label: "Sale return", url: `/sales/${id}/return`, method: "POST", body: { items, method, reason } });
      if (result.queued) {
        toast.success("You're offline — return queued and will sync automatically");
      } else {
        setDone(result.data.data);
        toast.success("Return recorded");
      }
      refetch();
      setReturns({});
      setReason("");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;
  if (!sale) return null;

  return (
    <div>
      <PageHeader
        title="Sales Return / Refund"
        subtitle={`Invoice ${sale.invoiceNo} · ${fmtDate(sale.saleDate)}`}
        actions={
          <Link to="/sales" className="btn-secondary">
            <ArrowLeft className="w-4 h-4" /> Back to sales
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-5">
          <div className="hidden md:grid md:grid-cols-[1fr_90px_120px_120px] gap-2 text-xs font-semibold text-slate-500 px-1 mb-3">
            <span>Product</span><span>Qty sold</span><span>Unit ₹</span><span>Return qty</span>
          </div>
          <div className="space-y-2">
            {sale.items.map((it) => (
              <div key={it.id} className="grid grid-cols-1 md:grid-cols-[1fr_90px_120px_120px] gap-2 items-center border-b border-slate-100 pb-2">
                <p className="text-sm font-medium text-slate-800">{it.productName}</p>
                <p className="text-sm text-slate-600">{Number(it.quantity)} {it.unit || ""}</p>
                <p className="text-sm text-slate-600">{inr(it.rate)}</p>
                <input
                  type="number" min="0" max={Number(it.quantity)} step="any" className="input"
                  placeholder="0"
                  value={returns[it.id] || ""}
                  onChange={(e) => setQty(it.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 h-fit lg:sticky lg:top-20 space-y-4">
          <div>
            <label className="label">Refund method</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-xl px-2 py-2 text-xs font-semibold border ${
                    method === m ? "border-brand-500 bg-brand-50 text-brand-700" : "border-white/70 bg-white/60 text-slate-600"
                  }`}
                >
                  {titleCase(m).replace(" ", "")}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Refund settles against any outstanding due first, then the remainder is paid out via this method.
            </p>
          </div>
          <div>
            <label className="label">Reason (optional)</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, wrong item…" />
          </div>
          <button className="btn-danger w-full" onClick={submit} disabled={saving || totalReturnQty === 0}>
            <RotateCcw className="w-4 h-4" /> {saving ? "Processing…" : "Record return"}
          </button>
        </div>
      </div>

      {done && (
        <div className="card p-5 mt-5 border-emerald-200 bg-emerald-50/50">
          <h3 className="font-semibold text-slate-800 mb-2">Return {done.returnNo} recorded</h3>
          <div className="text-sm text-slate-600 space-y-1">
            <p>Refund total: <span className="font-semibold">{inr(done.refundTotal)}</span></p>
            <p>Adjusted from outstanding due: <span className="font-semibold">{inr(done.dueAdjusted)}</span></p>
            <p>Paid out ({titleCase(done.method).replace(" ", "")}): <span className="font-semibold">{inr(done.cashRefunded)}</span></p>
          </div>
          <button className="btn-secondary mt-3" onClick={() => navigate(`/invoices/${id}`)}>View original invoice</button>
        </div>
      )}
    </div>
  );
}
