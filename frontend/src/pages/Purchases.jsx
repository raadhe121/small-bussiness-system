import { useState } from "react";
import { TableSkeleton, CardGridSkeleton } from "../components/Skeleton";
import { Link } from "react-router-dom";
import { ArrowDownToLine, Plus, Eye } from "lucide-react";
import api, { errMsg } from "../services/api";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import SearchInput from "../components/SearchInput";
import Pagination from "../components/Pagination";

import EmptyState from "../components/EmptyState";
import useSelection from "../hooks/useSelection";
import BulkDeleteBar from "../components/BulkDeleteBar";
import { inr, fmtDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

export default function Purchases() {
  const toast = useToast();
  const { user } = useAuth();
  const canCreate = hasPermission(user?.role, "purchases:create");
  const canManage = hasPermission(user?.role, "purchases:manage");
  const [search, setSearch] = useState("");
  const { data, loading, refetch } = useFetch(
    () => api.get("/purchases", { params: { search: search || undefined, limit: 15 } }).then((r) => r.data.data),
    [search]
  );
  const items = data?.items || [];
  const selection = useSelection(items);

  const handleBulkDelete = async () => {
    try {
      const res = await api.delete("/purchases/bulk", { data: { ids: selection.selectedIds } });
      const { deleted, failed } = res.data.data || {};
      toast.success(`Deleted ${deleted || 0} purchases${failed?.length ? `, ${failed.length} skipped` : ""}`);
      selection.clear();
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Purchases"
        actions={canCreate && <Link to="/purchases/new" className="btn-primary"><Plus className="w-4 h-4" /> New Purchase</Link>}
      />

      <SearchInput className="sm:max-w-xs mb-4" value={search} onChange={setSearch} placeholder="Search bill or supplier..." />

      <BulkDeleteBar count={selection.count} label="purchases" onDelete={handleBulkDelete} onClear={selection.clear} />

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : data.items.length === 0 ? (
          <EmptyState icon={ArrowDownToLine} title="No purchases yet" action={canCreate && <Link to="/purchases/new" className="btn-primary"><Plus className="w-4 h-4" /> New Purchase</Link>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th w-10">
                      <input type="checkbox" checked={selection.allSelected} onChange={(e) => selection.toggleAll(e.target.checked)} aria-label="Select all" />
                    </th>
                    <th className="th">Bill</th>
                    <th className="th">Supplier</th>
                    <th className="th">Branch</th>
                    <th className="th">Date</th>
                    <th className="th">Method</th>
                    <th className="th text-right">Total</th>
                    <th className="th text-right">Due</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((p) => (
                    <tr key={p.id} className={selection.has(p.id) ? "hover:bg-slate-50/60 bg-brand-50/40" : "hover:bg-slate-50/60"}>
                      <td className="td">
                        <input type="checkbox" checked={selection.has(p.id)} onChange={() => selection.toggle(p.id)} aria-label="Select row" />
                      </td>
                      <td className="td font-semibold">{p.billNo || "—"}</td>
                      <td className="td">{p.supplier?.name || <span className="text-slate-400">—</span>}</td>
                      <td className="td text-slate-500">{p.branchName || "—"}</td>
                      <td className="td">{fmtDate(p.purchaseDate)}</td>
                      <td className="td"><span className="badge bg-slate-100 text-slate-600">{String(p.paymentMethod).replace("_", " ")}</span></td>
                      <td className="td text-right font-semibold">{inr(p.grandTotal)}</td>
                      <td className={`td text-right font-medium ${p.dueAmount > 0 ? "text-red-500" : "text-slate-400"}`}>{inr(p.dueAmount)}</td>
                      <td className="td"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={data.meta} onPage={() => {}} />
          </>
        )}
      </div>
    </div>
  );
}
