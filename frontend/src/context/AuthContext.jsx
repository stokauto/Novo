/* eslint-disable react-hooks/set-state-in-effect */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (err) {
      // Sessão expirada / não autenticado — comportamento esperado para visitantes
      if (err?.response?.status && err.response.status !== 401) {
        console.error("[auth.refresh]", err);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data);
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // Logout local prossegue mesmo se servidor falhar
      console.warn("[auth.logout]", err?.message || err);
    }
    setUser(null);
  };

  // Memoize context value to avoid unnecessary re-renders of consumers
  const ctxValue = { user, loading, login, register, logout, refresh, setUser };

  return (
    <AuthContext.Provider value={ctxValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
