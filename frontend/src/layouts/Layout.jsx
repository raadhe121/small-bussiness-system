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
  Plus,
  ChevronDown,
  Shield,
  ShieldCheck,
  ScanLine,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api, { errMsg } from "../services/api";
import InstallPrompt from "../components/InstallPrompt";
import { ROLE_LABELS, fmtDateTime } from "../utils/format";
import { hasPermission } from "../utils/permissions";
import OfflineBar from "../components/OfflineBar";

const NAV_GROUPS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, permission: "dashboard:view" },
  {
    label: "Catalog",
    icon: Package,
    items: [
      { to: "/products", label: "Products", desc: "Manage your items & pricing", icon: Package, permission: "products:view" },
      { to: "/categories", label: "Categories", desc: "Organize products into groups", icon: Tags, permission: "categories:view" },
      { to: "/inventory", label: "Inventory", desc: "Stock levels & adjustments", icon: Boxes, permission: "inventory:view" },
    ],
  },
  {
    label: "People",
    icon: Users2,
    items: [
      { to: "/customers", label: "Customers", desc: "Customer list & balances", icon: Users2, permission: "customers:view" },
      { to: "/suppliers", label: "Suppliers", desc: "Supplier list & balances", icon: Truck, permission: "suppliers:view" },
    ],
  },
  {
    label: "Business",
    icon: ShoppingCart,
    items: [
      { to: "/sales", label: "Sales", desc: "Invoices you've issued", icon: ShoppingCart, permission: "sales:view" },
      { to: "/pos", label: "POS Billing", desc: "Scan, charge & print receipts", icon: ScanLine, permission: "sales:create" },
      { to: "/purchases", label: "Purchases", desc: "Bills from your suppliers", icon: ArrowDownToLine, permission: "purchases:view" },
      { to: "/payments", label: "Payments", desc: "Money in & money out", icon: Wallet, permission: "payments:view" },
      { to: "/expenses", label: "Expenses", desc: "Day-to-day spending", icon: ReceiptIndianRupee, permission: "expenses:view" },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    items: [
      { to: "/reports", label: "Reports", desc: "Business performance", icon: BarChart3, permission: "reports:view" },
      { to: "/gst", label: "GST Summary", desc: "Tax figures for filing", icon: Percent, permission: "gst:view" },
      { to: "/invoices", label: "All Invoices", desc: "Search every invoice", icon: FileText, permission: "invoices:view" },
    ],
  },
];

/** Returns only the nav groups/items the user's role is allowed to see. */
function visibleNav(role) {
  return NAV_GROUPS.map((group) =>
    group.items
      ? { ...group, items: group.items.filter((item) => hasPermission(role, item.permission)) }
      : group
  ).filter((group) => !group.items || group.items.length > 0).filter((g) => g.permission === undefined || hasPermission(role, g.permission));
}

function useClickOutside(onOutside) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    const esc = (e) => e.key === "Escape" && onOutside();
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [onOutside]);
  return ref;
}

function DesktopMenu({ role }) {
  const [open, setOpen] = useState(null);
  const ref = useClickOutside(() => setOpen(null));
  const groups = visibleNav(role);

  return (
    <nav ref={ref} className="hidden lg:flex items-center gap-1">
      {groups.map((group) =>
        group.items ? (
          <div key={group.label} className="relative">
            <button
              onClick={() => setOpen(open === group.label ? null : group.label)}
              className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                open === group.label ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
              }`}
            >
              {group.label}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open === group.label ? "rotate-180" : ""}`} />
            </button>
            {open === group.label && (
              <div className="absolute left-0 top-full mt-2 w-72 card p-2 z-40 animate-fade">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(null)}
                    className={({ isActive }) =>
                      `flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                        isActive ? "bg-white/70" : "hover:bg-white/60"
                      }`
                    }
                  >
                    <span className="mt-0.5 rounded-lg bg-brand-100/70 text-brand-600 p-1.5 shrink-0">
                      <item.icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
                      <span className="block text-xs text-slate-400 truncate">{item.desc}</span>
                    </span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ) : (
          <NavLink
            key={group.to}
            to={group.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
              }`
            }
          >
            {group.label}
          </NavLink>
        )
      )}
    </nav>
  );
}

function DrawerContent({ onNavigate, role }) {
  const groups = visibleNav(role);
  const canTeam = hasPermission(role, "users:manage");
  const canSettings = hasPermission(role, "settings:manage");
  const canRoles = hasPermission(role, "roles:manage");
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {groups.map((group, gi) =>
        group.items ? (
          <div key={gi}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{group.label}</p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                  }`
                }
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ) : (
          <div key={gi}>
            <NavLink
              to={group.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive ? "bg-brand-600 text-white" : "text-slate-800 hover:bg-brand-50 hover:text-brand-700"
                }`
              }
            >
              <group.icon className="w-[18px] h-[18px]" />
              {group.label}
            </NavLink>
          </div>
        )
      )}
      {(canTeam || canSettings || canRoles) && (
        <div>
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Account</p>
          {canTeam && (
            <NavLink
              to="/users"
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                }`
              }
            >
              <UserCog className="w-[18px] h-[18px]" /> Team
            </NavLink>
          )}
          {canRoles && (
            <NavLink
              to="/roles"
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                }`
              }
            >
              <Shield className="w-[18px] h-[18px]" /> Roles & Permissions
            </NavLink>
          )}
          {canSettings && (
            <NavLink
              to="/settings"
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                }`
              }
            >
              <Settings className="w-[18px] h-[18px]" /> Settings
            </NavLink>
          )}
        </div>
      )}
    </nav>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const navigate = useNavigate();
  const boxRef = useClickOutside(() => setResults(null));

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

  const go = (path) => {
    setResults(null);
    setQ("");
    navigate(path);
  };

  const hasResults =
    results && (results.products?.length || results.customers?.length || results.suppliers?.length || results.invoices?.length);

  return (
    <div ref={boxRef} className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="input pl-9 bg-white/50 border-white/60 backdrop-blur-md focus:bg-white/80 focus:ring-2"
        placeholder="Search products, customers, invoices..."
      />
      {hasResults && (
        <div className="absolute top-full mt-2 w-full card p-2 z-40 max-h-96 overflow-y-auto animate-fade">
          {[
            ["Products", results.products, (p) => `/products?search=${p.sku}`],
            ["Customers", results.customers, (c) => `/customers/${c.id}`],
            ["Suppliers", results.suppliers, (s) => `/suppliers/${s.id}`],
            ["Invoices", results.invoices, () => `/invoices`],
          ].map(([label, items, pathOf]) =>
            items?.length ? (
              <div key={label} className="mb-1 last:mb-0">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                {items.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => go(pathOf(item))}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-brand-50 text-sm"
                  >
                    <span className="font-medium">{item.name || item.invoiceNo}</span>
                    {(item.sku || item.phone || item.customerName) && (
                      <span className="text-slate-400 ml-2 text-xs">{item.sku || item.phone || item.customerName}</span>
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
  const ref = useClickOutside(() => setOpen(false));

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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        className={`relative p-2 rounded-full transition-colors ${open ? "bg-brand-50 text-brand-600" : "hover:bg-white/60 text-slate-500"}`}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 card z-40 overflow-hidden animate-fade">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-brand-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {items.length === 0 && <p className="px-4 py-6 text-sm text-slate-400 text-center">No notifications</p>}
            {items.map((n) => (
              <Link
                key={n.id}
                to={n.link || "#"}
                onClick={() => setOpen(false)}
                className={`block px-4 py-3 hover:bg-white/60 ${!n.isRead ? "bg-brand-50/50" : ""}`}
              >
                <p className="text-sm font-medium text-slate-700">{n.title}</p>
                {n.message && <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>}
                <p className="text-[11px] text-slate-400 mt-1">{fmtDateTime(n.createdAt)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useClickOutside(() => setMenuOpen(false));
  const navigate = useNavigate();

  const role = user?.role;
  const canCreateSale = hasPermission(role, "sales:create");
  const canSearch = hasPermission(role, "search:use");
  const canNotifications = hasPermission(role, "notifications:view");
  const canTeam = hasPermission(role, "users:manage");
  const canSettings = hasPermission(role, "settings:manage");
  const canRoles = hasPermission(role, "roles:manage");

  const signOut = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <OfflineBar />
      {/* Top navigation */}
      <header className="sticky top-0 z-30 bg-white/55 backdrop-blur-2xl border-b border-white/50 shadow-[0_4px_24px_rgba(31,38,135,0.06)]">
        {/* Row 1 */}
        <div className="h-16 flex items-center gap-3 px-4 sm:px-6 max-w-[1400px] w-full mx-auto">
          <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-white/60" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <span className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-1.5 shadow-sm">
              <Store className="w-5 h-5 text-white" />
            </span>
            <span className="hidden sm:block font-bold text-lg tracking-tight text-slate-900">
              Business<span className="text-brand-600">Hub</span>
            </span>
          </Link>

          <DesktopMenu role={role} />

          <div className="flex-1" />

          {canSearch && <GlobalSearch />}

          {canCreateSale && (
            <Link to="/sales/new" className="btn-secondary hidden lg:inline-flex !py-2">
              <Plus className="w-4 h-4" /> New Sale
            </Link>
          )}
          {canCreateSale && (
            <Link to="/pos" className="btn-primary hidden md:inline-flex !py-2 shadow-sm">
              <ScanLine className="w-4 h-4" /> POS
            </Link>
          )}

          {canNotifications && <NotificationBell />}

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-full hover:bg-white/60 p-1 pr-2 transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-sm font-bold flex items-center justify-center shadow-sm">
                {user?.name?.charAt(0)?.toUpperCase()}
              </span>
              <span className="hidden md:block text-left">
                <span className="block text-xs font-semibold text-slate-700 leading-tight">{user?.name}</span>
                <span className="block text-[11px] text-slate-400 leading-tight">{ROLE_LABELS[user?.role]}</span>
              </span>
              <ChevronDown className="hidden md:block w-3.5 h-3.5 text-slate-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 card z-40 p-1.5 animate-fade">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
                {canRoles && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/roles");
                    }}
                    className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-white/60"
                  >
                    <Shield className="w-4 h-4 text-slate-400" /> Roles & Permissions
                  </button>
                )}
                {canSettings && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/settings");
                    }}
                    className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-white/60"
                  >
                    <Settings className="w-4 h-4 text-slate-400" /> Settings & profile
                  </button>
                )}
                {canTeam && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/users");
                    }}
                    className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-white/60"
                  >
                    <UserCog className="w-4 h-4 text-slate-400" /> Team
                  </button>
                )}
                {user?.isPlatformAdmin && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/platform");
                    }}
                    className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm text-slate-900 font-medium hover:bg-slate-100"
                  >
                    <ShieldCheck className="w-4 h-4 text-brand-600" /> Platform Admin
                  </button>
                )}
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/80 backdrop-blur-2xl flex flex-col shadow-2xl transform transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200">
          <Link to="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <span className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-1.5">
              <Store className="w-5 h-5 text-white" />
            </span>
            <span className="font-bold text-lg tracking-tight text-slate-900">
              Business<span className="text-brand-600">Hub</span>
            </span>
          </Link>
          <button className="text-slate-400 hover:text-slate-600" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        <DrawerContent onNavigate={() => setMobileOpen(false)} role={role} />
        <div className="p-3 border-t border-slate-200">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-[18px] h-[18px]" /> Sign out
          </button>
        </div>
      </aside>

      {/* Page content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto animate-fade">
        <InstallPrompt />
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        BusinessHub — made for Indian small businesses
      </footer>
    </div>
  );
}
