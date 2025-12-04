import { createContext, useState, useEffect } from "react";
import API from "./api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  async function login(email, password) {
    const res = await API.post("/login", { email, password });
    localStorage.setItem("token", res.data.token);
    const profile = await API.get("/profile");
    setUser(profile.data.user);
  }

  async function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  async function refreshProfile() {
    try {
      const res = await API.get("/profile");
      setUser(res.data.user);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    refreshProfile();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}