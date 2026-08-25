import { useState, useMemo, useCallback, useEffect } from "react";
import { PageSkeleton } from "../components/Skeleton";
import { useNavigate } from "react-router-dom";
import {
  ScanLine, Pause, Play, Trash2, Plus, Minus, Printer, ShoppingCart,
  User, X, Search,
} from "lucide-react";
import api, { errMsg } from "../services/api";
import { submitOrQueue } from "../services/offlineQueue";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import BarcodeScanner from "../components/BarcodeScanner";
import ThermalReceipt from "../components/ThermalReceipt";
import Modal from "../components/Modal";
import { inr, titleCase } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"];

function computeTotals(cart, billDiscount) {
  let subtotal = 0, itemDiscount = 0, tax = 0;
  const lines = cart.map((it) => {
    const gross = it.quantity * it.rate;
    const disc = Number(it.discount || 0);
    const taxable = Math.max(0, gross - disc);
    const taxAmt = round2(taxable * (Number(it.taxRate) || 0) / 100);
    subtotal += gross;
    itemDiscount += disc;
    tax += taxAmt;
    return { ...it, gross, taxable, taxAmt };
  });
  const netSubtotal = subtotal - itemDiscount;
  const ratio = billDiscount > 0 && netSubtotal > 0 ? Math.min(0.9999, Number(billDiscount) / netSubtotal) : 0;
  const discTotal = round2(itemDiscount + netSubtotal * ratio);
  const taxableTotal = round2(netSubtotal * (1 - ratio));
  const taxTotal = round2(tax * (1 - ratio));
  const grandTotal = round2(taxableTotal + taxTotal);
  return { lines, subtotal: round2(subtotal), discount: discTotal, taxableTotal, taxTotal, grandTotal };
}

export default function PosPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReturn = hasPermission(user?.role, "sales:create");

  const { data: products, loading: pLoading } = useFetch(
    () => api.get("/products?limit=1000&status=ACTIVE").then((r) => r.data.data.items),
    []
  );
  const { data: customers } = useFetch(
    () => api.get("/customers?limit=1000").then((r) => r.data.data.items),
    []
  );
  const { data: business } = useFetch(() => api.get("/business").then((r) => r.data.data), []);

  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [billDiscount, setBillDiscount] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [heldBills, setHeldBills] = useState([]);
  const [heldOpen, setHeldOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const productMap = useMemo(() => new Map((products || []).map((p) => [p.id, p])), [products]);
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products || [];
    return (products || []).filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || "").includes(q)
    );
  }, [products, search]);

  const totals = useMemo(() => computeTotals(cart, billDiscount), [cart, billDiscount]);
  const paidAmount = paidAmountInput === "" ? totals.grandTotal : Math.min(Number(paidAmountInput) || 0, totals.grandTotal);
  const dueAmount = round2(Math.max(0, totals.grandTotal - paidAmount));

  const loadHeldBills = useCallback(async () => {
    try {
      const res = await api.get("/pos/hold");
      setHeldBills(res.data.data.items);
    } catch {
      /* non-fatal */
    }
  }, []);
  useEffect(() => { loadHeldBills(); }, [loadHeldBills]);

  const addProduct = useCallback((product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: round2(l.quantity + 1) } : l));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          rate: product.sellingPrice,
          taxRate: product.taxRate,
          discount: 0,
          quantity: 1,
          currentStock: product.currentStock,
        },
      ];
    });
  }, []);

  const addByBarcode = useCallback(async (code) => {
    try {
      const res = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
      addProduct(res.data.data);
      setScannerOpen(false);
      toast.success(`Added ${res.data.data.name}`);
    } catch (err) {
      toast.error(errMsg(err, "No product for this barcode"));
    }
  }, [addProduct, toast]);

  const setLine = (productId, patch) =>
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));

  const removeLine = (productId) => setCart((prev) => prev.filter((l) => l.productId !== productId));

  const holdBill = async () => {
    if (!cart.length) return toast.error("Add at least one item before holding");
    try {
      const selectedCustomer = customers?.find((c) => c.id === customerId);
      const result = await submitOrQueue({
        label: "Hold bill",
        url: "/pos/hold",
        method: "POST",
        body: {
          name: selectedCustomer ? selectedCustomer.name : "Walk-in",
          customerId: customerId || null,
          customerName: selectedCustomer?.name || null,
          items: cart.map((l) => ({
            productId: l.productId,
            name: l.name,
            unit: l.unit,
            quantity: l.quantity,
            rate: l.rate,
            discount: l.discount,
            taxRate: l.taxRate,
          })),
          paymentMethod,
          discount: billDiscount,
          total: totals.grandTotal,
        },
      });
      toast.success(result.queued ? "Bill queued — will sync" : "Bill held aside");
      setCart([]);
      setCustomerId("");
      setBillDiscount(0);
      setPaidAmountInput("");
      loadHeldBills();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const resumeBill = async (bill) => {
    try {
      const res = await api.get(`/pos/hold/${bill.id}`);
      const b = res.data.data;
      setCart(
        b.items.map((it) => ({
          productId: it.productId,
          name: it.name,
          unit: it.unit || "",
          rate: it.rate,
          taxRate: it.taxRate || 0,
          discount: it.discount || 0,
          quantity: it.quantity,
          currentStock: productMap.get(it.productId)?.currentStock ?? 0,
        }))
      );
      setCustomerId(b.customerId || "");
      setPaymentMethod(b.paymentMethod || "CASH");
      setBillDiscount(b.discount || 0);
      setPaidAmountInput("");
      // Resuming consumes the parked bill.
      await api.delete(`/pos/hold/${bill.id}`);
      setHeldOpen(false);
      loadHeldBills();
      toast.success(`Resumed "${b.name}"`);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const discardBill = async (id) => {
    try {
      const result = await submitOrQueue({ label: "Discard held bill", url: `/pos/hold/${id}`, method: "DELETE" });
      toast.success(result.queued ? "Discard queued — will sync" : "Held bill discarded");
      loadHeldBills();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const completeSale = async () => {
    if (!cart.length) return toast.error("Add at least one product");
    if (dueAmount > 0 && !customerId)
      return toast.error("Collect full payment or select a customer for credit");

    for (const l of cart) {
      const p = productMap.get(l.productId);
      if (p && l.quantity > p.currentStock)
        return toast.error(`Insufficient stock for "${p.name}" (${p.currentStock} ${p.unit})`);
    }

    setSaving(true);
    try {
      const result = await submitOrQueue({
        label: "POS sale",
        url: "/sales",
        method: "POST",
        body: {
          customerId: customerId || null,
          items: cart.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            rate: l.rate,
            discount: l.discount || 0,
            taxRate: l.taxRate || 0,
          })),
          discount: billDiscount,
          paymentMethod: dueAmount > 0 ? "CREDIT" : paymentMethod,
          paidAmount,
        },
      });
      if (result.queued) {
        toast.success("You're offline — sale queued and will sync automatically");
        setCart([]);
        setCustomerId("");
        setBillDiscount(0);
        setPaidAmountInput("");
      } else {
        setReceipt(result.data.data);
        setCart([]);
        setCustomerId("");
        setBillDiscount(0);
        setPaidAmountInput("");
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
      <EmptyState
        icon={ShoppingCart}
        title="No active products"
        subtitle="Add products (with barcodes) before using the POS."
        action={<button onClick={() => navigate("/products")} className="btn-primary">Go to Products</button>}
      />
    );

  return (
    <div>
      <PageHeader
        title="POS Billing"
        subtitle="Scan, build the bill, take payment and print a receipt"
        actions={
          <>
            <button className="btn-secondary" onClick={() => setHeldOpen(true)}>
              <Pause className="w-4 h-4" /> Held ({heldBills.length})
            </button>
            <button className="btn-primary" onClick={completeSale} disabled={saving || !cart.length}>
              <Printer className="w-4 h-4" /> {saving ? "Saving..." : "Charge & Print"}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: product pad + cart */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4">
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="Search products or scan…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="btn-secondary shrink-0" onClick={() => setScannerOpen(true)}>
                <ScanLine className="w-4 h-4" /> Scan
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  disabled={p.currentStock <= 0}
                  className="text-left rounded-xl border border-white/70 bg-white/60 px-3 py-2 hover:bg-white/90 disabled:opacity-40 transition-colors"
                >
                  <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{inr(p.sellingPrice)} · {p.currentStock} {p.unit}</p>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="col-span-full text-sm text-slate-400 text-center py-4">No matching products</p>
              )}
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="hidden md:grid md:grid-cols-[1fr_70px_90px_90px_36px] gap-2 text-xs font-semibold text-slate-500 px-1">
              <span>Product</span><span>Qty</span><span>Rate</span><span>Disc</span><span></span>
            </div>
            {cart.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">Cart is empty — scan or pick a product.</p>
            )}
            {cart.map((l) => (
              <div key={l.productId} className="grid grid-cols-1 md:grid-cols-[1fr_70px_90px_90px_36px] gap-2 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{l.name}</p>
                  <p className="text-xs text-slate-400">{inr(round2(l.quantity * l.rate))} {l.unit}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200" onClick={() => setLine(l.productId, { quantity: Math.max(1, round2(l.quantity - 1)) })}>
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number" min="0.001" step="any" className="input text-center px-1"
                    value={l.quantity}
                    onChange={(e) => setLine(l.productId, { quantity: Number(e.target.value) })}
                  />
                  <button className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200" onClick={() => setLine(l.productId, { quantity: round2(l.quantity + 1) })}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="number" min="0" step="0.01" className="input"
                  value={l.rate}
                  onChange={(e) => setLine(l.productId, { rate: Number(e.target.value) })}
                />
                <input
                  type="number" min="0" step="0.01" className="input"
                  value={l.discount}
                  onChange={(e) => setLine(l.productId, { discount: Number(e.target.value) })}
                />
                <button className="justify-self-end p-2 rounded-lg text-red-400 hover:bg-red-50" onClick={() => removeLine(l.productId)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: summary + payment */}
        <div className="card p-5 h-fit lg:sticky lg:top-20 space-y-4">
          <div>
            <label className="label flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Customer</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {(customers || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Payment method</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-xl px-2 py-2 text-xs font-semibold border transition-colors ${
                    paymentMethod === m
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-white/70 bg-white/60 text-slate-600 hover:bg-white/80"
                  }`}
                >
                  {titleCase(m).replace(" ", "")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Amount received (₹)</label>
            <input
              type="number" min="0" step="0.01" className="input"
              placeholder={String(totals.grandTotal)}
              value={paidAmountInput}
              onChange={(e) => setPaidAmountInput(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Bill discount (₹)</label>
            <input
              type="number" min="0" step="0.01" className="input"
              value={billDiscount}
              onChange={(e) => setBillDiscount(e.target.value === "" ? 0 : Number(e.target.value))}
            />
          </div>

          <div className="space-y-2 text-sm border-t border-slate-200 pt-3">
            <Row label="Taxable" value={inr(totals.taxableTotal)} />
            <Row label="Tax" value={inr(totals.taxTotal)} />
            <Row label="Grand total" value={inr(totals.grandTotal)} bold big />
            <Row label="Received" value={inr(paidAmount)} />
            <Row label="Balance due" value={inr(dueAmount)} tone={dueAmount > 0 ? "text-red-600" : "text-emerald-600"} bold />
          </div>

          <div className="flex gap-2 pt-1">
            <button className="btn-secondary flex-1" onClick={holdBill} disabled={!cart.length}>
              <Pause className="w-4 h-4" /> Hold
            </button>
            <button className="btn-primary flex-1" onClick={completeSale} disabled={saving || !cart.length}>
              {saving ? "Saving..." : "Charge"}
            </button>
          </div>
          {canReturn && cart.length === 0 && (
            <button className="btn-secondary w-full" onClick={() => navigate("/sales")}>
              Process a return
            </button>
          )}
        </div>
      </div>

      {scannerOpen && <BarcodeScanner onDetect={addByBarcode} onClose={() => setScannerOpen(false)} />}

      {/* Held bills drawer */}
      {heldOpen && (
        <Modal open={heldOpen} onClose={() => setHeldOpen(false)} title={`Held bills (${heldBills.length})`} size="md">
          {heldBills.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No held bills.</p>
          ) : (
            <div className="space-y-2">
              {heldBills.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{b.name}</p>
                    <p className="text-xs text-slate-500">
                      {b.items.length} item(s) · {inr(b.total)} · {titleCase(b.paymentMethod).replace(" ", "")}
                    </p>
                  </div>
                  <button className="btn-secondary !py-1.5 text-xs" onClick={() => resumeBill(b)}>
                    <Play className="w-3.5 h-3.5" /> Resume
                  </button>
                  <button className="p-2 rounded-lg text-red-400 hover:bg-red-50" onClick={() => discardBill(b.id)}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Receipt / print */}
      {receipt && (
        <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Sale complete" size="md">
          <div className="no-print flex gap-2 mb-4">
            <button className="btn-primary flex-1" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Print receipt
            </button>
            <button className="btn-secondary" onClick={() => setReceipt(null)}>Close</button>
          </div>
          <ThermalReceipt business={business} sale={receipt} />
        </Modal>
      )}
    </div>
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
