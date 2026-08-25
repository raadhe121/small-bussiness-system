import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionGate from "./components/PermissionGate";
import Layout from "./layouts/Layout";

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
import Purchases from "./pages/Purchases";
import NewPurchase from "./pages/NewPurchase";
import Payments from "./pages/Payments";
import Expenses from "./pages/Expenses";
import Invoices from "./pages/Invoices";
import InvoiceView from "./pages/InvoiceView";
import Reports from "./pages/Reports";
import GST from "./pages/GST";
import Users from "./pages/Users";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<ProtectedRoute guestOnly><Login /></ProtectedRoute>} />
      <Route path="/register" element={<ProtectedRoute guestOnly><Register /></ProtectedRoute>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<ProtectedRoute requiresBusiness={false}><Onboarding /></ProtectedRoute>} />

      {/* App (tenant) */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/suppliers/:id" element={<SupplierDetail />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/sales/new" element={<NewSale />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/purchases/new" element={<NewPurchase />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:saleId" element={<InvoiceView />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/gst" element={<GST />} />
        <Route path="/users" element={<Users />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
