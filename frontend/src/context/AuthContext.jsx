import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../services/api";
import { setUserPermissions } from "../utils/permissions";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bh_user")) || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("bh_token")) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/auth/me");
      setUserPermissions(res.data.data?.permissions);
      setUser(res.data.data);
      localStorage.setItem("bh_user", JSON.stringify(res.data.data));
    } catch {
      setUser(null);
      setUserPermissions(null);
      localStorage.removeItem("bh_token");
      localStorage.removeItem("bh_user");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyAuth = (data) => {
    localStorage.setItem("bh_token", data.token);
    localStorage.setItem("bh_user", JSON.stringify(data.user));
    setUserPermissions(data.user?.permissions);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    return applyAuth(res.data.data);
  };

  const register = async (payload) => {
    const res = await api.post("/auth/register", payload);
    return applyAuth(res.data.data);
  };

  const createBusiness = async (payload) => {
    const res = await api.post("/business", payload);
    return applyAuth(res.data.data);
  };

  const logout = () => {
    localStorage.removeItem("bh_token");
    localStorage.removeItem("bh_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, createBusiness, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
