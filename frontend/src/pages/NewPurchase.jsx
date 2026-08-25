import { useState, useMemo } from "react";
import { PageSkeleton } from "../components/Skeleton";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Plus, PackagePlus } from "lucide-react";
import api, { errMsg } from "../services/api";
import { submitOrQueue } from "../services/offlineQueue";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import { inr, toInputDate } from "../utils/format";

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

export default function NewPurchase() {
  const toast = useToast();
  const navigate = useNavigate();

  const { data: products, loading: pLoading } = useFetch(
    () => api.get("/products?limit=100").then((r) => r.data.data.items),
    []
  );
  const { data: suppliers } = useFetch(() => api.get("/suppliers?limit=100").then((r) => r.data.data.items), []);

  const [supplierId, setSupplierId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [lines, setLines] = useState([{ productId: "", quantity: 1, rate: "", discount: 0 }]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [notes, setNotes] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(toInputDate());
  const [saving, setSaving] = useState(false);

  const productMap = useMemo(() => new Map((products || []).map((p) => [p.id, p])), [products]);

  const totals = useMemo(() => {
    let taxable = 0;
    let taxTotal = 0;
    for (const l of lines) {
      if (!l.productId || !l.rate) continue;
      const gross = l.quantity * Number(l.rate);
      const t = Math.max(0, gross - Number(l.discount || 0));
      taxable += t;
      taxTotal += t * (productMap.get(l.productId)?.taxRate ?? 0) / 100;
    }
    const ratio = billDiscount > 0 && taxable > 0 ? Math.min(0.9999, Number(billDiscount) / taxable) : 0;
    return {
      netTaxable: round2(taxable * (1 - ratio)),
      netTax: round2(taxTotal * (1 - ratio)),
    };
  }, [lines, billDiscount, productMap]);
  totals.grandTotal = round2(totals.netTaxable + totals.netTax);

  const paidAmount = paidAmountInput === "" ? totals.grandTotal : Math.min(Number(paidAmountInput), totals.grandTotal);
  const dueAmount = round2(Math.max(0, totals.grandTotal - paidAmount));

  const submit = async (e) => {
    e.preventDefault();
    const valid = lines.filter((l) => l.productId && l.quantity > 0 && l.rate !== "");
    if (!valid.length) return toast.error("Add at least one product line");
    if (dueAmount > 0 && !supplierId) return toast.error("Select a supplier or pay the full amount");

    setSaving(true);
    try {
      const payload = {
        supplierId: supplierId || null,
        billNo: billNo || undefined,
        items: valid.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          rate: Number(l.rate),
          discount: Number(l.discount || 0),
          taxRate: productMap.get(l.productId)?.taxRate ?? 0,
        })),
        discount: Number(billDiscount || 0),
        paymentMethod,
        paidAmount,
        notes: notes || undefined,
        purchaseDate: new Date(`${purchaseDate}T12:00:00Z`).toISOString(),
      };
      const result = await submitOrQueue({ label: "New purchase", url: "/purchases", method: "POST", body: payload });
      if (result.queued) {
        toast.success("You're offline — purchase queued and will sync automatically");
        navigate("/purchases");
      } else {
        toast.success("Purchase recorded — stock updated");
        navigate("/purchases");
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  if (pLoading) return <PageSkeleton />;
  if (!products?.length)
    return (
      <EmptyState icon={PackagePlus} title="No products yet" subtitle="Add products first." action={<Link className="btn-primary" to="/products">Go to Products</Link>} />
    );

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="New Purchase"
        subtitle="Stock increases automatically when the purchase is saved"
        actions={
          <>
            <Link to="/purchases" className="btn-secondary">Cancel</Link>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Purchase"}</button>
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-4">
          <div className="card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="label">Supplier</label>
                <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">No supplier</option>
                  {(suppliers || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Bill number</label>
                <input className="input" placeholder="Supplier bill no." value={billNo} onChange={(e) => setBillNo(e.target.value)} />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="hidden md:grid md:grid-cols-[1fr_100px_110px_110px_40px] gap-2 text-xs font-semibold text-slate-500 px-1">
                <span>Product</span><span>Qty</span><span>Rate ₹</span><span>Disc ₹</span><span></span>
              </div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_100px_110px_110px_40px] gap-2 items-center">
                  <select
                    required
                    className="input"
                    value={l.productId}
                    onChange={(e) => {
                      const p = productMap.get(e.target.value);
                      setLines(lines.map((x, idx) => idx === i ? { ...x, productId: e.target.value, rate: x.rate === "" ? p?.purchasePrice ?? "" : x.rate } : x));
                    }}
                  >
                    <option value="">Select product</option>
                    {(products || []).map((pr) => (
                      <option key={pr.id} value={pr.id}>{pr.name}</option>
                    ))}
                  </select>
                  <input type="number" min="0.001" step="any" placeholder="Qty" className="input" value={l.quantity} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                  <input type="number" min="0" step="0.01" placeholder="Rate" className="input" value={l.rate} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, rate: e.target.value } : x))} />
                  <input type="number" min="0" step="0.01" placeholder="Disc." className="input" value={l.discount} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...x, discount: e.target.value } : x))} />
                  <button type="button" onClick={() => lines.length > 1 && setLines(lines.filter((_, idx) => idx !== i))} disabled={lines.length === 1}
                    className="justify-self-end p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setLines([...lines, { productId: "", quantity: 1, rate: "", discount: 0 }])} className="btn-secondary !py-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add line
              </button>
            </div>
          </div>

          <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Payment method</label>
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={dueAmount > 0}>
                {["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"].map((m) => (
                  <option key={m} value={m}>{m.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount paid (₹)</label>
              <input type="number" min="0" step="0.01" className="input" placeholder={String(totals.grandTotal)} value={paidAmountInput} onChange={(e) => setPaidAmountInput(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card p-5 h-fit sticky top-20 space-y-3 text-sm">
          <h2 className="font-semibold text-slate-800 mb-1">Purchase summary</h2>
          <Row label="Taxable amount" value={inr(totals.netTaxable)} />
          <Row label="GST total" value={inr(totals.netTax)} />
          <div className="pt-2">
            <label className="label">Bill discount (₹)</label>
            <input type="number" min="0" step="0.01" className="input" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value === "" ? 0 : Number(e.target.value))} />
          </div>
          <div className="border-t border-slate-200 pt-2 mt-2 space-y-2">
            <Row label="Grand total" value={inr(totals.grandTotal)} bold big />
            <Row label="Paid" value={inr(paidAmount)} />
            <Row label="Balance due" value={inr(dueAmount)} tone={dueAmount > 0 ? "text-red-600" : "text-emerald-600"} bold />
          </div>
          {dueAmount > 0 && supplierId && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
              Due will be added to the supplier's outstanding balance.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

function Row({ label, value, bold, big, tone }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`${big ? "font-semibold" : ""} text-slate-600`}>{label}</span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${tone || "text-slate-800"} ${big ? "text-lg" : ""}`}>{value}</span>
    </div>
  );
}
