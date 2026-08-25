import { useState } from "react";
import { Pencil, Trash2, Eye, Store } from "lucide-react";
import api, { errMsg } from "../../services/api";
import { submitOrQueue } from "../../services/offlineQueue";
import useFetch from "../../hooks/useFetch";
import { useToast } from "../../context/ToastContext";
import PageHeader from "../../components/PageHeader";
import { TableSkeleton } from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import SearchInput from "../../components/SearchInput";
import Pagination from "../../components/Pagination";
import Modal from "../../components/Modal";
import ConfirmDialog from "../../components/ConfirmDialog";
import { fmtDate, fmtDateTime } from "../../utils/format";

const emptyForm = { name: "", ownerName: "", phone: "", email: "", gstin: "" };

export default function PlatformBusinesses() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const query = `/platform/businesses?page=${page}&limit=10${search ? `&search=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}`;
  const { data, loading, refetch } = useFetch(
    () => api.get(query).then((r) => r.data.data),
    [query]
  );

  const openEdit = (b) => {
    setEditTarget(b);
    setForm({ name: b.name, ownerName: b.ownerName, phone: b.phone || "", email: b.email || "", gstin: b.gstin || "" });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await submitOrQueue({ label: "Update business", url: `/platform/businesses/${editTarget.id}`, method: "PUT", body: form });
      toast.success(result.queued ? "Change queued — will sync" : "Business updated");
      setEditTarget(null);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (b) => {
    try {
      const result = await submitOrQueue({ label: "Toggle business", url: `/platform/businesses/${b.id}`, method: "PUT", body: { isActive: !b.isActive } });
      toast.success(result.queued ? "Change queued — will sync" : b.isActive ? "Business deactivated — users can no longer sign in" : "Business activated");
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const doDelete = async () => {
    setSaving(true);
    try {
      const result = await submitOrQueue({ label: "Delete business", url: `/platform/businesses/${deleteTarget.id}`, method: "DELETE" });
      toast.success(result.queued ? "Delete queued — will sync" : `${deleteTarget.name} and all its data were deleted`);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (b) => {
    try {
      const res = await api.get(`/platform/businesses/${b.id}`);
      setDetail(res.data.data);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div>
      <PageHeader title="Businesses" subtitle="Every tenant on the platform" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by name, owner, email, GSTIN..."
          className="flex-1"
        />
        <select
          className="input sm:w-44"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : !data?.items?.length ? (
          <EmptyState icon={Store} title="No businesses found" subtitle="Try a different search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="th">Business</th>
                  <th className="th">Owner</th>
                  <th className="th">Users</th>
                  <th className="th">Data</th>
                  <th className="th">Joined</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm shrink-0">
                          {b.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{b.name}</p>
                          <p className="text-xs text-slate-400 truncate">{[b.location, b.gstin].filter(Boolean).join(" · ") || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <p className="text-sm">{b.ownerName}</p>
                      <p className="text-xs text-slate-400">{b.owner?.email || b.email || "—"}</p>
                    </td>
                    <td className="td">{b.counts.users}</td>
                    <td className="td text-xs text-slate-500">
                      {b.counts.products} products · {b.counts.customers} customers · {b.counts.sales} sales
                    </td>
                    <td className="td text-slate-500 text-sm">{fmtDate(b.createdAt)}</td>
                    <td className="td">
                      <span className={`badge ${b.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        {b.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openDetail(b)} title="View details" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(b)} title="Edit" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleStatus(b)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${b.isActive ? "hover:bg-red-50 text-red-400 hover:text-red-600" : "hover:bg-emerald-50 text-emerald-600"}`}
                        >
                          {b.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => setDeleteTarget(b)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination meta={data?.meta} onPage={setPage} />
      </div>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit ${editTarget?.name}`}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Business name *</label>
            <input required minLength={2} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Owner name *</label>
            <input required minLength={2} className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone *</label>
              <input required minLength={6} className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">GSTIN</label>
            <input maxLength={15} className="input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Business details" size="lg">
        {!detail ? null : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Name", detail.business.name],
                ["Owner", detail.business.ownerName],
                ["Phone", detail.business.phone],
                ["Email", detail.business.email || "—"],
                ["GSTIN", detail.business.gstin || "—"],
                ["Location", [detail.business.city, detail.business.state].filter(Boolean).join(", ") || "—"],
                ["Type", detail.business.businessType],
                ["Invoice prefix", detail.business.invoicePrefix],
                ["Total revenue", `₹${Number(detail.totalRevenue).toLocaleString("en-IN")}`],
                ["Created", fmtDateTime(detail.business.createdAt)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{k}</p>
                  <p className="text-slate-700 mt-0.5 break-all">{v}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Records</p>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(detail.counts).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 p-2.5 text-center">
                    <p className="font-bold text-slate-800">{v}</p>
                    <p className="text-[11px] text-slate-400 capitalize">{k.replace("s", "")}{v === 1 ? "" : "s"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Team ({detail.business.users.length})</p>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 max-h-48 overflow-y-auto">
                {detail.business.users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-700">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge bg-slate-100 text-slate-600">{u.role}</span>
                      <span className={`badge ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        {u.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {detail.recentSales.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Recent sales</p>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {detail.recentSales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium text-slate-700">{s.invoiceNo}</span>
                      <span className="text-slate-500">{fmtDate(s.saleDate)}</span>
                      <span className="font-semibold">₹{Number(s.grandTotal).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        loading={saving}
        title={`Delete ${deleteTarget?.name}?`}
        message="This permanently deletes the business along with all its users, products, invoices and records. This cannot be undone."
        confirmLabel="Delete business"
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
