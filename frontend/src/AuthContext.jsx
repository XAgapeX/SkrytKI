import { createContext, useEffect, useState, useCallback } from "react";
import API from "./api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await API.get("/profile");
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  async function login(email, password) {
    const res = await API.post("/login", { email, password });
    localStorage.setItem("token", res.data.token);

    const profile = await API.get("/profile");
    setUser(profile.data.user);
    return profile.data.user;
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return (
      <AuthContext.Provider value={{ user, authLoading, login, logout, refreshProfile }}>
        {children}
      </AuthContext.Provider>
  );
}
