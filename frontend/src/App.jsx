import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionGate from "./components/PermissionGate";
import PlatformRoute from "./components/PlatformRoute";
import Layout from "./layouts/Layout";
import PlatformLayout from "./layouts/PlatformLayout";

// Auth / onboarding
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";

// App pages
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Suppliers from "./pages/Suppliers";
import SupplierDetail from "./pages/SupplierDetail";
import Sales from "./pages/Sales";
import NewSale from "./pages/NewSale";
import PosPage from "./pages/PosPage";
import SalesReturn from "./pages/SalesReturn";
import Purchases from "./pages/Purchases";
import NewPurchase from "./pages/NewPurchase";
import Payments from "./pages/Payments";
import Expenses from "./pages/Expenses";
import Invoices from "./pages/Invoices";
import InvoiceView from "./pages/InvoiceView";
import Reports from "./pages/Reports";
import GST from "./pages/GST";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import Settings from "./pages/Settings";

// Platform admin panel
import PlatformOverview from "./pages/platform/PlatformOverview";
import PlatformBusinesses from "./pages/platform/PlatformBusinesses";
import PlatformUsers from "./pages/platform/PlatformUsers";

export default function App() {
  return (
    <Routes>
      {/* Public */}
            <Route path="/" element={<ProtectedRoute guestOnly><Login /></ProtectedRoute>} />

      <Route path="/login" element={<ProtectedRoute guestOnly><Login /></ProtectedRoute>} />
      <Route path="/register" element={<ProtectedRoute guestOnly><Register /></ProtectedRoute>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<ProtectedRoute requiresBusiness={false}><Onboarding /></ProtectedRoute>} />

      {/* App (tenant) */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<PermissionGate permission="dashboard:view"><Dashboard /></PermissionGate>} />
        <Route path="/products" element={<PermissionGate permission="products:view"><Products /></PermissionGate>} />
        <Route path="/categories" element={<PermissionGate permission="categories:view"><Categories /></PermissionGate>} />
        <Route path="/inventory" element={<PermissionGate permission="inventory:view"><Inventory /></PermissionGate>} />
        <Route path="/customers" element={<PermissionGate permission="customers:view"><Customers /></PermissionGate>} />
        <Route path="/customers/:id" element={<PermissionGate permission="customers:view"><CustomerDetail /></PermissionGate>} />
        <Route path="/suppliers" element={<PermissionGate permission="suppliers:view"><Suppliers /></PermissionGate>} />
        <Route path="/suppliers/:id" element={<PermissionGate permission="suppliers:view"><SupplierDetail /></PermissionGate>} />
        <Route path="/sales" element={<PermissionGate permission="sales:view"><Sales /></PermissionGate>} />
        <Route path="/sales/new" element={<PermissionGate permission="sales:create"><NewSale /></PermissionGate>} />
        <Route path="/pos" element={<PermissionGate permission="sales:create"><PosPage /></PermissionGate>} />
        <Route path="/sales/:id/return" element={<PermissionGate permission="sales:create"><SalesReturn /></PermissionGate>} />
        <Route path="/purchases" element={<PermissionGate permission="purchases:view"><Purchases /></PermissionGate>} />
        <Route path="/purchases/new" element={<PermissionGate permission="purchases:create"><NewPurchase /></PermissionGate>} />
        <Route path="/payments" element={<PermissionGate permission="payments:view"><Payments /></PermissionGate>} />
        <Route path="/expenses" element={<PermissionGate permission="expenses:view"><Expenses /></PermissionGate>} />
        <Route path="/invoices" element={<PermissionGate permission="invoices:view"><Invoices /></PermissionGate>} />
        <Route path="/invoices/:saleId" element={<PermissionGate permission="invoices:view"><InvoiceView /></PermissionGate>} />
        <Route path="/reports" element={<PermissionGate permission="reports:view"><Reports /></PermissionGate>} />
        <Route path="/gst" element={<PermissionGate permission="gst:view"><GST /></PermissionGate>} />
        <Route path="/users" element={<PermissionGate permission="users:manage"><Users /></PermissionGate>} />
        <Route path="/roles" element={<PermissionGate permission="roles:manage"><Roles /></PermissionGate>} />
        <Route path="/settings" element={<PermissionGate permission="settings:manage"><Settings /></PermissionGate>} />
      </Route>
      {/* Platform admin panel */}
      <Route element={<PlatformRoute><PlatformLayout /></PlatformRoute>}>
        <Route path="/platform" element={<PlatformOverview />} />
        <Route path="/platform/businesses" element={<PlatformBusinesses />} />
        <Route path="/platform/users" element={<PlatformUsers />} />
      </Route>

    </Routes>
  );
}
