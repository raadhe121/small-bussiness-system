import { useState } from "react";
import { TableSkeleton, CardGridSkeleton } from "../components/Skeleton";
import { Link } from "react-router-dom";
import { ShoppingCart, Plus, Eye, RotateCcw } from "lucide-react";
import api, { errMsg } from "../services/api";
import useFetch from "../hooks/useFetch";
import { useToast } from "../context/ToastContext";
import PageHeader from "../components/PageHeader";
import SearchInput from "../components/SearchInput";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import useSelection from "../hooks/useSelection";
import BulkDeleteBar from "../components/BulkDeleteBar";
import { inr, fmtDate, titleCase } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

export default function Sales() {
  const toast = useToast();
  const { user } = useAuth();
  const canCreate = hasPermission(user?.role, "sales:create");
  const canManage = hasPermission(user?.role, "sales:manage");
  const [search, setSearch] = useState("");
  const page = 1;
  const { data, loading, refetch } = useFetch(
    () => api.get("/sales", { params: { search: search || undefined, limit: 15 } }).then((r) => r.data.data),
    [search]
  );
  void page;
  const items = data?.items || [];
  const selection = useSelection(items);

  const handleBulkDelete = async () => {
    try {
      const res = await api.delete("/sales/bulk", { data: { ids: selection.selectedIds } });
      const { deleted, failed } = res.data.data || {};
      toast.success(`Deleted ${deleted || 0} sales${failed?.length ? `, ${failed.length} skipped` : ""}`);
      selection.clear();
      refetch();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle={data?.summary ? `Total ${inr(data.summary.totalSales)} · Collected ${inr(data.summary.totalPaid)} · Due ${inr(data.summary.totalDue)}` : undefined}
        actions={canCreate && <Link to="/sales/new" className="btn-primary"><Plus className="w-4 h-4" /> New Sale</Link>}
      />

      <SearchInput className="sm:max-w-xs mb-4" value={search} onChange={setSearch} placeholder="Search invoice or customer..." />

      <BulkDeleteBar count={selection.count} label="sales" onDelete={handleBulkDelete} onClear={selection.clear} />

      <div className="card overflow-hidden">
        {loading ? (<TableSkeleton rows={8} cols={7} />) : data.items.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No sales yet" subtitle="Create your first sale." action={canCreate && <Link to="/sales/new" className="btn-primary"><Plus className="w-4 h-4" /> New Sale</Link>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="th w-10">
                      <input type="checkbox" checked={selection.allSelected} onChange={(e) => selection.toggleAll(e.target.checked)} aria-label="Select all" />
                    </th>
                    <th className="th">Invoice</th>
                    <th className="th">Customer</th>
                    <th className="th">Branch</th>
                    <th className="th">Date</th>
                    <th className="th">Method</th>
                    <th className="th text-right">Total</th>
                    <th className="th text-right">Due</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((s) => (
                    <tr key={s.id} className={selection.has(s.id) ? "hover:bg-slate-50/60 bg-brand-50/40" : "hover:bg-slate-50/60"}>
                      <td className="td">
                        <input type="checkbox" checked={selection.has(s.id)} onChange={() => selection.toggle(s.id)} aria-label="Select row" />
                      </td>
                      <td className="td font-semibold">{s.invoiceNo}</td>
                      <td className="td">{s.customer?.name || <span className="text-slate-400">Walk-in</span>}</td>
                      <td className="td text-slate-500">{s.branchName || "—"}</td>
                      <td className="td">{fmtDate(s.saleDate)}</td>
                      <td className="td"><span className="badge bg-slate-100 text-slate-600">{titleCase(s.paymentMethod)}</span></td>
                      <td className="td text-right font-semibold">{inr(s.grandTotal)}</td>
                      <td className={`td text-right font-medium ${s.dueAmount > 0 ? "text-red-500" : "text-slate-400"}`}>{inr(s.dueAmount)}</td>
                      <td className="td">
                        <div className="flex items-center gap-1 justify-end">
                          {canCreate && (
                            <Link to={`/sales/${s.id}/return`} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Return / refund">
                              <RotateCcw className="w-4 h-4" />
                            </Link>
                          )}
                          <Link to={`/invoices/${s.id}`} className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600" title="View invoice">
                            <Eye className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
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
