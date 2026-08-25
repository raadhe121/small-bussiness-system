import { useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Tags,
  Boxes,
  Users2,
  Truck,
  ShoppingCart,
  ArrowDownToLine,
  Wallet,
  ReceiptIndianRupee,
  FileText,
  BarChart3,
  Percent,
  UserCog,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,
  Search,
  Store,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api, { errMsg } from "../services/api";
import { ROLE_LABELS, fmtDateTime } from "../utils/format";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { section: "Catalog" },
  { to: "/products", label: "Products", icon: Package },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { section: "Parties" },
  { to: "/customers", label: "Customers", icon: Users2 },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { section: "Transactions" },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/purchases", label: "Purchases", icon: ArrowDownToLine },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/expenses", label: "Expenses", icon: ReceiptIndianRupee },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { section: "Insights" },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/gst", label: "GST", icon: Percent },
  { section: "Manage" },
  { to: "/users", label: "Team", icon: UserCog },
  { to: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent({ onNavigate }) {
  const { user } = useAuth();
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
      {NAV.map((item, i) =>
        item.section ? (
          <p key={i} className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {item.section}
          </p>
        ) : (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            {item.label}
          </NavLink>
        )
      )}
    </nav>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const navigate = useNavigate();
  const boxRef = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
        setResults(res.data.data);
      } catch {
        setResults(null);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setResults(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (path) => {
    setResults(null);
    setQ("");
    navigate(path);
  };

  return (
    <div ref={boxRef} className="relative flex-1 max-w-md hidden sm:block">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="input pl-9 bg-slate-100 border-transparent focus:bg-white"
        placeholder="Search products, customers, invoices..."
      />
      {results && (
        <div className="absolute top-full mt-1 w-full card p-2 z-40 max-h-96 overflow-y-auto">
          {[
            ["Products", results.products, (p) => `/products?search=${p.sku}`],
            ["Customers", results.customers, (c) => `/customers/${c.id}`],
            ["Suppliers", results.suppliers, (s) => `/suppliers/${s.id}`],
            ["Invoices", results.invoices, (i) => `/invoices`],
          ].map(([label, items, pathOf]) =>
            items?.length ? (
              <div key={label} className="mb-1">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                {items.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => go(pathOf(item))}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-sm"
                  >
                    <span className="font-medium">{item.name || item.invoiceNo}</span>
                    {(item.sku || item.phone || item.customerName) && (
                      <span className="text-slate-400 ml-2 text-xs">
                        {item.sku || item.phone || item.customerName}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try {
      const res = await api.get("/notifications");
      setItems(res.data.data.items.slice(0, 8));
      setUnread(res.data.data.unreadCount);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const markAll = async () => {
    await api.put("/notifications/read-all").catch(() => {});
    load();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-slate-200/60 text-slate-600"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 card z-40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll} className="text-xs text-brand-600 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {items.length === 0 && (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">No notifications</p>
              )}
              {items.map((n) => (
                <Link
                  key={n.id}
                  to={n.link || "#"}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-3 hover:bg-slate-50 ${!n.isRead ? "bg-brand-50/50" : ""}`}
                >
                  <p className="text-sm font-medium text-slate-700">{n.title}</p>
                  {n.message && <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>}
                  <p className="text-[11px] text-slate-400 mt-1">{fmtDateTime(n.createdAt)}</p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800">
          <Link to="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <span className="rounded-lg bg-brand-500 p-1.5">
              <Store className="w-5 h-5 text-white" />
            </span>
            <span className="text-white font-bold text-lg">BusinessHub</span>
          </Link>
          <button className="lg:hidden text-slate-400" onClick={() => setMobileOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="w-[18px] h-[18px]" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6">
          <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <GlobalSearch />
          <div className="flex-1 sm:hidden" />
          <NotificationBell />
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-full hover:bg-slate-100 p-1 pr-2"
            >
              <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center">
                {user?.name?.charAt(0)?.toUpperCase()}
              </span>
              <span className="hidden md:block text-left">
                <span className="block text-xs font-semibold text-slate-700 leading-tight">{user?.name}</span>
                <span className="block text-[11px] text-slate-400 leading-tight">{ROLE_LABELS[user?.role]}</span>
              </span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 card z-40 p-1.5">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/settings");
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-50"
                  >
                    Settings & profile
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      navigate("/login");
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
