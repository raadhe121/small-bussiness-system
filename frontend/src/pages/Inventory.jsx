import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Boxes, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal } from "lucide-react";
import api, { errMsg } from "../services/api";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import SearchInput from "../components/SearchInput";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { inr, compactInr } from "../utils/format";

export default function Inventory() {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = hasPermission(user?.role, "inventory:manage");
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const lowStock = params.get("lowStock") === "true" || false;
  const page = parseInt(params.get("page") || "1", 10);

  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjForm, setAdjForm] = useState({ type: "STOCK_IN", quantity: "", note: "" });
  const [saving, setSaving] = useState(false);

  const { data, loading, refetch } = useFetch(
    () => api.get("/inventory", {
      params: { search, page, limit: 12, ...(lowStock ? { lowStock: "true" } : {}) },
    }).then((r) => r.data.data),
    [search, page, lowStock]
  );
  const { data: valuation } = useFetch(
    () => api.get("/inventory/valuation").then((r) => r.data.data),
    []
  );

  const openAdjust = (row) => {
    setAdjForm({ type: "STOCK_IN", quantity: "", note: "" });
    setAdjustTarget(row);
  };

  const saveAdjust = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/inventory/adjust", {
        productId: adjustTarget.productId,
        type: adjForm.type,
        quantity: Number(adjForm.quantity),
        note: adjForm.note || undefined,
      });
      toast.success("Stock updated");
      setAdjustTarget(null);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Current stock, valuation and alerts" />

      {/* Valuation summary */}
      {valuation && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          <SummaryBox label="Products" value={valuation.productCount} />
          <SummaryBox label="Stock value (cost)" value={compactInr(valuation.costValue)} />
          <SummaryBox label="Retail value" value={compactInr(valuation.retailValue)} />
          <SummaryBox label="Potential profit" value={compactInr(valuation.potentialProfit)} tone="text-emerald-600" />
          <SummaryBox label="Low / Out of stock" value={`${valuation.lowStockCount} / ${valuation.outOfStockCount}`} tone={valuation.lowStockCount + valuation.outOfStockCount > 0 ? "text-amber-600" : ""} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          className="sm:max-w-xs flex-1"
          value={search}
          onChange={(v) => setParams(v ? { search: v, ...(lowStock ? { lowStock: "true" } : {}) } : {})}
          placeholder="Search product or SKU..."
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => setParams(e.target.checked ? { ...(search ? { search } : {}), lowStock: "true" } : {})}
          />
          Low stock only
        </label>
        <Link to="/inventory?history=1" onClick={(e) => e.preventDefault()} className="hidden" />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner className="block mx-auto my-14" />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Boxes} title="No inventory records" subtitle="Stock appears here when you add products with opening stock, make purchases, or adjust stock." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th">Product</th>
                    <th className="th">Category</th>
                    <th className="th text-center">In stock</th>
                    <th className="th text-center">Min</th>
                    <th className="th text-right">Cost price</th>
                    <th className="th text-right">Stock value</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="td">
                        <p className="font-medium">{r.productName}</p>
                        <p className="text-xs text-slate-400">{r.sku}</p>
                      </td>
                      <td className="td text-slate-500">{r.categoryName || "—"}</td>
                      <td className="td text-center">
                        <span className={`badge ${
                          r.quantity <= 0 ? "bg-red-100 text-red-600"
                            : r.isLowStock ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {r.quantity} {r.unit}
                        </span>
                      </td>
                      <td className="td text-center text-slate-500">{r.minStock}</td>
                      <td className="td text-right">{inr(r.purchasePrice)}</td>
                      <td className="td text-right font-semibold">{inr(r.stockValue)}</td>
                      <td className="td">
                        {canManage && (
                          <button onClick={() => openAdjust(r)} className="btn-secondary !py-1.5 !px-2.5 text-xs ml-auto flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5" /> Adjust
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={data.meta} onPage={(p) => setParams({ ...(search ? { search } : {}), page: String(p) })} />
          </>
        )}
      </div>

      <Modal open={!!adjustTarget} onClose={() => setAdjustTarget(null)} title={`Adjust stock — ${adjustTarget?.productName}`}>
        <form onSubmit={saveAdjust} className="space-y-4">
          <p className="text-sm text-slate-500">
            Current stock: <b>{adjustTarget?.quantity} {adjustTarget?.unit}</b>
          </p>
          <div>
            <label className="label">Type</label>
            <select className="input" value={adjForm.type} onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value })}>
              <option value="STOCK_IN">Stock in (+)</option>
              <option value="STOCK_OUT">Stock out (−)</option>
              <option value="ADJUSTMENT">Set counted quantity</option>
            </select>
          </div>
          <div>
            <label className="label">{adjForm.type === "ADJUSTMENT" ? "Counted quantity *" : "Quantity *"}</label>
            <input required type="number" min={adjForm.type === "ADJUSTMENT" ? 0 : 0.001} step="0.001" className="input" value={adjForm.quantity} onChange={(e) => setAdjForm({ ...adjForm, quantity: e.target.value })} />
          </div>
          <div>
            <label className="label">Note</label>
            <input className="input" placeholder="Reason / reference" value={adjForm.note} onChange={(e) => setAdjForm({ ...adjForm, note: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setAdjustTarget(null)}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Apply adjustment"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SummaryBox({ label, value, tone = "text-slate-800" }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${tone}`}>{value}</p>
    </div>
  );
}
