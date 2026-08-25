import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { BranchProvider } from "./context/BranchContext";
import { ToastProvider } from "./context/ToastContext";
import { registerServiceWorker } from "./services/swRegister";
import { initOfflineSync } from "./services/offlineQueue";
import "./index.css";

registerServiceWorker();
initOfflineSync((synced, remaining) =>
  window.dispatchEvent(new CustomEvent("bh-offline-synced", { detail: { synced, remaining } }))
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
