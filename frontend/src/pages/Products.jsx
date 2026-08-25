import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, Plus, Pencil, Trash2 } from "lucide-react";
import api, { errMsg } from "../services/api";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import SearchInput from "../components/SearchInput";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { inr } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

const UNITS = ["PCS", "KG", "GM", "LITRE", "ML", "METER", "BOX", "PACKET", "DOZEN", "BAG"];
const emptyForm = {
  name: "", sku: "", barcode: "", description: "", categoryId: "",
  unit: "PCS", purchasePrice: "", sellingPrice: "", taxRate: 18,
  minStock: 5, openingStock: "", status: "ACTIVE",
};

export default function Products() {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = hasPermission(user?.role, "products:manage");
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const page = parseInt(params.get("page") || "1", 10);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, loading, refetch } = useFetch(
    () => api.get("/products", { params: { search, page, limit: 12 } }).then((r) => r.data.data),
    [search, page]
  );
  const { data: categories } = useFetch(() => api.get("/categories?limit=100").then((r) => r.data.data.items), []);

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditItem(p);
    setForm({
      name: p.name, sku: p.sku, barcode: p.barcode || "", description: p.description || "",
      categoryId: p.category?.id || "", unit: p.unit,
      purchasePrice: p.purchasePrice, sellingPrice: p.sellingPrice, taxRate: p.taxRate,
      minStock: p.minStock, openingStock: "", status: p.status,
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.categoryId) delete payload.categoryId;
      else payload.categoryId = payload.categoryId;
      if (payload.openingStock === "" && !editItem) delete payload.openingStock;
      if (editItem) {
        await api.put(`/products/${editItem.id}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/products", payload);
        toast.success("Product created");
      }
      setShowForm(false);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try {
      await api.delete(`/products/${deleteTarget.id}`);
      toast.success("Product deleted");
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Your catalog with prices, GST rates and stock"
        actions={canManage && <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add Product</button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          className="sm:max-w-xs flex-1"
          value={search}
          onChange={(v) => setParams(v ? { search: v } : {})}
          placeholder="Search name, SKU or barcode..."
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Spinner className="block mx-auto my-14" />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products found"
            subtitle={search ? "Try a different search." : "Add your first product to start selling."}
            action={!search && canManage && <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add Product</button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th">Product</th>
                    <th className="th">Category</th>
                    <th className="th text-right">Purchase</th>
                    <th className="th text-right">Selling</th>
                    <th className="th text-center">GST</th>
                    <th className="th text-center">Stock</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="td">
                        <p className="font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.sku}{p.unit !== "PCS" ? ` · ${p.unit}` : ""}</p>
                      </td>
                      <td className="td text-slate-500">{p.category?.name || "—"}</td>
                      <td className="td text-right">{inr(p.purchasePrice)}</td>
                      <td className="td text-right font-semibold">{inr(p.sellingPrice)}</td>
                      <td className="td text-center">{p.taxRate}%</td>
                      <td className="td text-center">
                        <span className={`badge ${
                          p.currentStock <= 0 ? "bg-red-100 text-red-600"
                            : p.isLowStock ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {p.currentStock} {p.unit}
                        </span>
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          {canManage && (
                            <>
                              <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Edit">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
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

      {/* Create / edit modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? "Edit product" : "Add product"} size="lg">
        <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Product name *</label>
            <input required minLength={2} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">SKU *</label>
            <input required className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} disabled={!!editItem} />
          </div>
          <div>
            <label className="label">Barcode</label>
            <input className="input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Uncategorized</option>
              {(categories || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Purchase price (₹)</label>
            <input type="number" min="0" step="0.01" required className="input" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
          </div>
          <div>
            <label className="label">Selling price (₹) *</label>
            <input type="number" min="0" step="0.01" required className="input" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
          </div>
          <div>
            <label className="label">GST rate (%)</label>
            <select className="input" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}>
              {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
          <div>
            <label className="label">Minimum stock alert</label>
            <input type="number" min="0" step="0.001" className="input" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          </div>
          {!editItem && (
            <div>
              <label className="label">Opening stock</label>
              <input type="number" min="0" step="0.001" className="input" placeholder="0" value={form.openingStock} onChange={(e) => setForm({ ...form, openingStock: e.target.value })} />
            </div>
          )}
          {editItem && (
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="DISABLED">Inactive</option>
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea rows={2} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : editItem ? "Save changes" : "Create product"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title={`Delete "${deleteTarget?.name}"?`}
        message="This cannot be undone. Products with sales history cannot be deleted."
        confirmLabel="Delete"
        loading={false}
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
