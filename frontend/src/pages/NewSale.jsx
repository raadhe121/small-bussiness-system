import { useState, useMemo } from "react";
import { submitOrQueue } from "../services/offlineQueue";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Plus, ShoppingCart } from "lucide-react";
import api, { errMsg } from "../services/api";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { inr, toInputDate } from "../utils/format";

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

export default function NewSale() {
  const toast = useToast();
  const navigate = useNavigate();

  const { data: products, loading: pLoading } = useFetch(
    () => api.get("/products?limit=100&status=ACTIVE").then((r) => r.data.data.items),
    []
  );
  const { data: customers } = useFetch(
    () => api.get("/customers?limit=100").then((r) => r.data.data.items),
    []
  );
  const { data: business } = useFetch(() => api.get("/business").then((r) => r.data.data), []);

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState([{ productId: "", quantity: 1, rate: "", discount: 0 }]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [notes, setNotes] = useState("");
  const [saleDate, setSaleDate] = useState(toInputDate());
  const [saving, setSaving] = useState(false);

  const productMap = useMemo(() => new Map((products || []).map((p) => [p.id, p])), [products]);

  const totals = useMemo(() => {
    let taxable = 0;
    let taxTotal = 0;
    for (const l of lines) {
      if (!l.productId || !l.rate) continue;
      const gross = l.quantity * Number(l.rate);
      const t = Math.max(0, gross - Number(l.discount || 0));
      const tax = t * (productMap.get(l.productId)?.taxRate ?? 0) / 100;
      taxable += t;
      taxTotal += tax;
    }
    const ratio = billDiscount > 0 && taxable > 0 ? Math.min(0.9999, Number(billDiscount) / taxable) : 0;
    const netTaxable = round2(taxable * (1 - ratio));
    const netTax = round2(taxTotal * (1 - ratio));
    return {
      netTaxable,
      netTax,
      grandTotal: round2(netTaxable + netTax),
      cgst: round2(netTax / 2),
      sgst: round2(netTax - netTax / 2),
      igst: null,
    };
  }, [lines, billDiscount, productMap]);

  const paidAmount = paidAmountInput === "" ? totals.grandTotal : Math.min(Number(paidAmountInput), totals.grandTotal);
  const dueAmount = round2(Math.max(0, totals.grandTotal - paidAmount));

  const setLine = (i, patch) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const pickProduct = (i, productId) => {
    const p = productMap.get(productId);
    setLine(i, { productId, rate: p ? p.sellingPrice : "", quantity: 1 });
  };

  const addLine = () => setLines([...lines, { productId: "", quantity: 1, rate: "", discount: 0 }]);
  const removeLine = (i) => lines.length > 1 && setLines(lines.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    const valid = lines.filter((l) => l.productId && l.quantity > 0 && l.rate !== "");
    if (!valid.length) return toast.error("Add at least one product line");
    if (dueAmount > 0 && !customerId)
      return toast.error("Walk-in sales must be fully paid — select a customer or collect full payment");

    // Stock check
    for (const l of valid) {
      const p = productMap.get(l.productId);
      if (p && l.quantity > p.currentStock)
        return toast.error(`Insufficient stock for "${p.name}" (available ${p.currentStock} ${p.unit})`);
    }

    setSaving(true);
    const payload = {
      customerId: customerId || null,
      items: valid.map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        rate: Number(l.rate),
        discount: Number(l.discount || 0),
        taxRate: productMap.get(l.productId)?.taxRate ?? 0,
      })),
      discount: Number(billDiscount || 0),
      paymentMethod: dueAmount > 0 ? "CREDIT" : paymentMethod,
      paidAmount,
      notes: notes || undefined,
      saleDate: new Date(`${saleDate}T12:00:00Z`).toISOString(),
    };

    try {
      const result = await submitOrQueue({ label: "New sale", url: "/sales", method: "POST", body: payload });
      if (result.queued) {
        toast.success("You're offline — sale queued and will sync automatically");
        navigate("/sales");
      } else {
        toast.success(`Sale completed — invoice ${result.data.data.invoiceNo}`);
        navigate(`/invoices/${result.data.data.id}`);
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  if (pLoading) return <Spinner className="block mx-auto my-16" />;
  if (!products?.length)
    return (
      <EmptyState
        icon={ShoppingCart}
        title="No active products"
        subtitle="Add products before creating sales."
        action={<Link to="/products" className="btn-primary">Go to Products</Link>}
      />
    );

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="New Sale"
        subtitle="Stock reduces automatically when the sale completes"
        actions={
          <>
            <Link to="/sales" className="btn-secondary">Cancel</Link>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Complete Sale"}</button>
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Items */}
        <div className="xl:col-span-2 space-y-4">
          <div className="card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">Customer</label>
                <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Walk-in customer</option>
                  {(customers || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="hidden md:grid md:grid-cols-[1fr_90px_110px_110px_40px] gap-2 text-xs font-semibold text-slate-500 px-1">
                <span>Product</span><span>Qty</span><span>Rate ₹</span><span>Disc ₹</span><span></span>
              </div>
              {lines.map((l, i) => {
                const p = productMap.get(l.productId);
                return (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_90px_110px_110px_40px] gap-2 items-center">
                    <select
                      required
                      className="input"
                      value={l.productId}
                      onChange={(e) => pickProduct(i, e.target.value)}
                    >
                      <option value="">Select product</option>
                      {(products || []).map((pr) => (
                        <option key={pr.id} value={pr.id} disabled={pr.currentStock <= 0}>
                          {pr.name} ({pr.currentStock} {pr.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number" min="0.001" step="any" placeholder="Qty" className="input"
                      value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: Number(e.target.value) })}
                      max={p ? p.currentStock : undefined}
                    />
                    <input
                      type="number" min="0" step="0.01" placeholder="Rate" className="input"
                      value={l.rate}
                      onChange={(e) => setLine(i, { rate: e.target.value })}
                    />
                    <input
                      type="number" min="0" step="0.01" placeholder="Disc." className="input"
                      value={l.discount}
                      onChange={(e) => setLine(i, { discount: e.target.value })}
                    />
                    <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1}
                      className="justify-self-end p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              <button type="button" onClick={addLine} className="btn-secondary !py-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add line
              </button>
            </div>
          </div>

          <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Payment method</label>
              <select
                className="input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={dueAmount > 0}
              >
                {["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"].map((m) => (
                  <option key={m} value={m}>{m.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount received (₹)</label>
              <input
                type="number" min="0" step="0.01"
                className="input"
                placeholder={String(totals.grandTotal)}
                value={paidAmountInput}
                onChange={(e) => setPaidAmountInput(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional remarks on the invoice" />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="card p-5 h-fit sticky top-20">
          <h2 className="font-semibold text-slate-800 mb-3">Bill summary</h2>
          <div className="space-y-2 text-sm">
            <Row label="Taxable amount" value={inr(totals.netTaxable)} />
            {!business?.state || !selectedCustomer?.state || selectedCustomer.state === business.state ? (
              <>
                <Row label={`CGST`} value={inr(totals.cgst)} />
                <Row label={`SGST`} value={inr(totals.sgst)} />
              </>
            ) : (
              <Row label="IGST" value={inr(totals.netTax)} />
            )}
            <div className="pt-2">
              <label className="label">Bill discount (₹)</label>
              <input type="number" min="0" step="0.01" className="input" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>
            <div className="border-t border-slate-200 pt-2 mt-2 space-y-2">
              <Row label="Grand total" value={inr(totals.grandTotal)} bold big />
              <Row label="Received" value={inr(paidAmount)} />
              <Row label="Balance due" value={inr(dueAmount)} tone={dueAmount > 0 ? "text-red-600" : "text-emerald-600"} bold />
            </div>
            {selectedCustomer && dueAmount > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mt-2">
                Due of {inr(dueAmount)} will be added to {selectedCustomer.name}'s outstanding balance.
              </p>
            )}
          </div>
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
