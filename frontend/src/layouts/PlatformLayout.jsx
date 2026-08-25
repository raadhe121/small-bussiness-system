import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Gauge,
  Store,
  Users2,
  LogOut,
  ArrowLeft,
  ShieldCheck,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

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

const NAV = [
  { to: "/platform", label: "Overview", icon: Gauge, end: true },
  { to: "/platform/businesses", label: "Businesses", icon: Store },
  { to: "/platform/users", label: "All Users", icon: Users2 },
];

export default function PlatformLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useClickOutside(() => setMenuOpen(false));

  const signOut = () => {
    logout();
    navigate("/login");
  };

  const navClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
    }`;

  const links = (onNavigate) =>
    NAV.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={navClass}
      >
        <item.icon className="w-[18px] h-[18px]" />
        {item.label}
      </NavLink>
    ));

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="h-16 flex items-center gap-3 px-4 sm:px-6 max-w-[1400px] w-full mx-auto">
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          <Link to="/platform" className="flex items-center gap-2.5 shrink-0">
            <span className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 p-1.5 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-white" />
            </span>
            <span className="font-bold text-lg tracking-tight text-slate-900 hidden sm:block">
              Business<span className="text-brand-600">Hub</span>
              <span className="ml-2 align-middle badge bg-slate-900 text-white !text-[10px]">Platform Admin</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 ml-6">{links()}</nav>

          <div className="flex-1" />

          {user?.businessId && (
            <Link
              to="/dashboard"
              className="hidden md:inline-flex btn-secondary !py-2 items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to my business
            </Link>
          )}

          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-full hover:bg-slate-100 p-1 pr-2 transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white text-sm font-bold flex items-center justify-center shadow-sm">
                {user?.name?.charAt(0)?.toUpperCase()}
              </span>
              <span className="hidden md:block text-left">
                <span className="block text-xs font-semibold text-slate-700 leading-tight">{user?.name}</span>
                <span className="block text-[11px] text-slate-400 leading-tight">Platform Admin</span>
              </span>
              <ChevronDown className="hidden md:block w-3.5 h-3.5 text-slate-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 card z-40 p-1.5 animate-fade">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
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
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col shadow-2xl transform transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200">
          <span className="flex items-center gap-2 font-bold tracking-tight">
            <ShieldCheck className="w-5 h-5 text-brand-600" /> Platform Admin
          </span>
          <button className="text-slate-400 hover:text-slate-600" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">{links(() => setMobileOpen(false))}</nav>
        {user?.businessId && (
          <NavLink to="/dashboard" onClick={() => setMobileOpen(false)} className="mx-3 mb-2 btn-secondary justify-center">
            <ArrowLeft className="w-4 h-4" /> Back to my business
          </NavLink>
        )}
        <div className="p-3 border-t border-slate-200">
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
            <LogOut className="w-[18px] h-[18px]" /> Sign out
          </button>
        </div>
      </aside>

      {/* Page content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto animate-fade">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        BusinessHub Platform — internal back-office
      </footer>
    </div>
  );
}
