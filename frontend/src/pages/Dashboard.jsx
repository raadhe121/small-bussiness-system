import { Link } from "react-router-dom";
import { PageSkeleton } from "../components/Skeleton";
import {
  IndianRupee, TrendingUp, ShoppingCart, ArrowDownToLine,
  ReceiptIndianRupee, Users2, Truck, Package, AlertTriangle,
  Wallet, Landmark, Plus,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import api from "../services/api";
import useFetch from "../hooks/useFetch";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import { inr, compactInr, fmtDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import { ShopIllustration } from "../components/Illustrations";
import { hasPermission } from "../utils/permissions";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role;
  const can = (p) => hasPermission(role, p);
  const canCreateSale = can("sales:create");
  const canCreatePurchase = can("purchases:create");
  const canViewSales = can("sales:view");
  const canViewPurchases = can("purchases:view");
  const canViewExpenses = can("expenses:view");
  const canViewCustomers = can("customers:view");
  const canViewSuppliers = can("suppliers:view");
  const canViewProducts = can("products:view");
  const canViewInventory = can("inventory:view");
  const { data, loading, error } = useFetch(() => api.get("/reports/dashboard").then((r) => r.data.data), []);

  if (loading) return <PageSkeleton />;
  if (error) return <EmptyState title="Could not load dashboard" subtitle={error.message} />;

  const d = data;

  return (
    <div>
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-r from-brand-700/90 via-brand-600/85 to-brand-500/80 text-white p-6 sm:p-8 mb-6 shadow-glass backdrop-blur-xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-brand-100 text-sm font-medium">{greeting()} 👋</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
              {user?.businessName || user?.name}
            </h1>
            <p className="text-brand-100 text-sm mt-1">Here's how your business is doing today.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <ShopIllustration className="hidden md:block w-36 h-auto drop-shadow-lg" />
            <div className="flex flex-col gap-2">
              {canCreateSale && (
                <Link
                  to="/sales/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-brand-700 px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-brand-50 transition-colors active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" /> New Sale
                </Link>
              )}
              {canCreatePurchase && (
                <Link
                  to="/purchases/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/25 transition-colors active:scale-[0.98]"
                >
                  <ArrowDownToLine className="w-4 h-4" /> New Purchase
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-24 -bottom-20 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* Today */}
      {(canViewSales || canViewPurchases || canViewExpenses) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          {canViewSales && <StatCard icon={IndianRupee} label="Today's Sales" value={inr(d.today.sales)} sub={`${d.today.salesCount} invoices`} tone="green" />}
          {canViewPurchases && <StatCard icon={ArrowDownToLine} label="Today's Purchases" value={inr(d.today.purchases)} sub={`${d.today.purchasesCount} bills`} tone="blue" />}
          {canViewExpenses && <StatCard icon={ReceiptIndianRupee} label="Today's Expenses" value={inr(d.today.expenses)} tone="red" />}
          {canViewSales && <StatCard icon={TrendingUp} label="Today's Profit" value={inr(d.today.profit)} tone="brand" />}
        </div>
      )}

      {/* Totals */}
      {(canViewCustomers || canViewSuppliers || canViewProducts || canViewInventory) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-5">
          {canViewCustomers && <StatCard icon={Users2} label="Customers" value={d.totals.customers} tone="slate" />}
          {canViewSuppliers && <StatCard icon={Truck} label="Suppliers" value={d.totals.suppliers} tone="slate" />}
          {canViewProducts && <StatCard icon={Package} label="Products" value={d.totals.products} tone="slate" />}
          {canViewInventory && <StatCard icon={AlertTriangle} label="Low Stock" value={d.inventoryAlerts} tone={d.inventoryAlerts > 0 ? "amber" : "slate"} />}
          {canViewCustomers && <StatCard icon={Wallet} label="To Collect" value={compactInr(d.totals.receivables)} tone="green" />}
          {canViewSuppliers && <StatCard icon={Landmark} label="To Pay" value={compactInr(d.totals.payables)} tone="red" />}
        </div>
      )}

      {/* Chart */}
      {canViewSales && (
        <div className="card p-4 sm:p-5 mb-5">
          <h2 className="font-semibold text-slate-800 mb-4">
            {canViewExpenses ? "Sales, profit & expenses — last 14 days" : "Sales & profit — last 14 days"}
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={d.chart}>
              <defs>
                <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tickFormatter={(v) => compactInr(v)} tick={{ fontSize: 11 }} stroke="#94a3b8" width={60} />
              <Tooltip formatter={(v, name) => [inr(v), name]} labelFormatter={(l) => fmtDate(l)} />
              <Legend />
              <Area type="monotone" dataKey="sales" name="Sales" stroke="#6366f1" fill="url(#gSales)" strokeWidth={2} />
              <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" fill="url(#gProfit)" strokeWidth={2} />
              {canViewExpenses && (
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f59e0b" fill="transparent" strokeWidth={2} strokeDasharray="5 4" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {(canViewSales || canViewPurchases || canViewInventory) && (
        <div className={`grid grid-cols-1 ${canViewSales && canViewPurchases && canViewInventory ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4`}>
        {/* Recent sales */}
        {canViewSales && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800 text-sm">Recent Sales</h2>
              <Link to="/sales" className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
            {d.recentSales.length === 0 ? (
              <EmptyState title="No sales yet" subtitle="Create your first sale to see it here." action={canCreateSale && <Link to="/sales/new" className="btn-primary">New Sale</Link>} />
            ) : (
            <ul className="divide-y divide-slate-100">
              {d.recentSales.map((s) => (
                <li key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{s.customerName}</p>
                    <p className="text-xs text-slate-400">{s.invoiceNo} · {fmtDate(s.saleDate)}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">{inr(s.grandTotal)}</span>
                </li>
              ))}
            </ul>
          )}
          </div>
        )}

        {/* Recent purchases */}
        {canViewPurchases && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800 text-sm">Recent Purchases</h2>
              <Link to="/purchases" className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
            {d.recentPurchases.length === 0 ? (
              <EmptyState title="No purchases yet" />
            ) : (
            <ul className="divide-y divide-slate-100">
              {d.recentPurchases.map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{p.supplierName}</p>
                    <p className="text-xs text-slate-400">{p.billNo || "—"} · {fmtDate(p.purchaseDate)}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-600">{inr(p.grandTotal)}</span>
                </li>
              ))}
            </ul>
          )}
          </div>
        )}

        {/* Inventory alerts */}
        {canViewInventory && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${d.lowStockProducts.length ? "text-amber-500" : "text-slate-300"}`} />
                Low Stock Alerts
              </h2>
              <Link to="/inventory?lowStock=true" className="text-xs text-brand-600 hover:underline">View all</Link>
            </div>
          {d.lowStockProducts.length === 0 ? (
            <EmptyState title="All stocked up!" subtitle="No products below minimum stock." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.lowStockProducts.slice(0, 6).map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.sku}</p>
                  </div>
                  <span className={`badge ${p.currentStock <= 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                    {p.currentStock <= 0 ? "Out of stock" : `${p.currentStock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          </div>
        )}
        </div>
      )}
    </div>
  );
}
