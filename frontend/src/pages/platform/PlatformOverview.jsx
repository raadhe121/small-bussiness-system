import { Link } from "react-router-dom";
import {
  Store,
  Users2,
  UserCheck,
  ShoppingCart,
  IndianRupee,
  Package,
  Contact,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import api from "../../services/api";
import useFetch from "../../hooks/useFetch";
import PageHeader from "../../components/PageHeader";
import StatCard from "../../components/StatCard";
import Spinner from "../../components/Spinner";
import { compactInr, fmtDate } from "../../utils/format";

export default function PlatformOverview() {
  const { data, loading } = useFetch(() => api.get("/platform/overview").then((r) => r.data.data), []);

  if (loading || !data) return <Spinner className="block mx-auto my-20" />;

  const { stats, recentBusinesses } = data;

  return (
    <div>
      <PageHeader
        title="Platform Overview"
        subtitle="Everything happening across BusinessHub"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Store} label="Businesses" value={stats.totalBusinesses} sub={`${stats.activeBusinesses} active · ${stats.inactiveBusinesses} inactive`} />
        <StatCard icon={TrendingUp} label="New businesses (30d)" value={stats.newBusinesses30d} tone="green" />
        <StatCard icon={Users2} label="Total users" value={stats.totalUsers} sub={`${stats.totalOwners} owners`} tone="blue" />
        <StatCard icon={UserCheck} label="Sales today" value={stats.todaySales} sub={`${compactInr(stats.todayRevenue)} collected`} tone="amber" />
        <StatCard icon={IndianRupee} label="Platform revenue" value={compactInr(stats.totalRevenue)} sub={`${stats.totalSales} invoices all-time`} tone="green" />
        <StatCard icon={ShoppingCart} label="Invoices issued" value={stats.totalSales} />
        <StatCard icon={Package} label="Products listed" value={stats.totalProducts} tone="slate" />
        <StatCard icon={Contact} label="Customers" value={stats.totalCustomers} tone="slate" />
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800 text-sm">Newest businesses</h2>
          <Link to="/platform/businesses" className="text-xs text-brand-600 hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {recentBusinesses.length === 0 && (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">No businesses yet</p>
          )}
          {recentBusinesses.map((b) => (
            <div key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-5 py-3.5 hover:bg-slate-50/60">
              <span className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm shrink-0">
                {b.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-slate-800 truncate">{b.name}</p>
                <p className="text-xs text-slate-400">
                  {b.ownerName}
                  {b.ownerEmail ? ` · ${b.ownerEmail}` : ""}
                  {b.location ? ` · ${b.location}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                <span>{b.userCount} users</span>
                <span>{b.salesCount} sales</span>
                <span>{fmtDate(b.createdAt)}</span>
                <span className={`badge ${b.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                  {b.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
