import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setToken } from "../api/client";
import type { AuthUser } from "../types";

type LoginResult = {
  user: AuthUser;
  needsOnboarding: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("lms-token")) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<LoginResult> {
    const result = await api.login(email, password);
    setToken(result.token);
    setUser(result.user);
    return {
      user: result.user,
      needsOnboarding: result.user.mustChangePassword === true || (result.user.role !== "admin" && !result.user.profile?.complete),
    };
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
