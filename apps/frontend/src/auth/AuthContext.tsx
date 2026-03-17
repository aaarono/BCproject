import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { http } from "../api/http";
import { disconnectSocket } from "../api/socket";

type User = {
  id: string;
  email: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  displayName?: string;
};

type AuthState = {
  user: User | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  isReady: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  async function refreshMe() {
    const res = await http.get<User>("/auth/me");
    setUser(res.data);
  }

  async function login() {
    await refreshMe();
  }

  async function logout() {
    try {
      await http.post("/auth/logout");
    } catch {
      // ignore network/logout errors to always clear local auth state
    }
    setUser(null);
    disconnectSocket();
  }

  useEffect(() => {
    (async () => {
      try {
        await refreshMe();
      } catch {
        setUser(null);
        disconnectSocket();
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({ user, login, logout, refreshMe, isReady }),
    [user, isReady, login],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
