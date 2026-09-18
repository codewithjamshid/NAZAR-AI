// Session (JWT + user) and the clinical constants from GET /meta.
// Thresholds always come from the server so no screen hard-codes clinical numbers.

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";

import { api, clearSession, getToken, setSession, storedUser } from "../api/client";
import type { Meta, User } from "../api/types";

interface SessionValue {
  token: string | null;
  user: User | null;
  meta: Meta | null;
  disclaimer: string;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const FALLBACK_DISCLAIMER = "Dastlabki tahlil. Shifokor tasdig'i talab qilinadi.";

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<User | null>(() => storedUser<User>());
  const [meta, setMeta] = useState<Meta | null>(null);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
    setMeta(null);
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const response = await api.login(phone, password);
    setSession(response.access_token, response.user);
    setToken(response.access_token);
    setUser(response.user);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener("nazar:unauthorized", onUnauthorized);
    return () => window.removeEventListener("nazar:unauthorized", onUnauthorized);
  }, [logout]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .meta()
      .then((value) => {
        if (!cancelled) setMeta(value);
      })
      .catch(() => {
        /* the panel still works without /meta; the timer then shows no colour */
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo<SessionValue>(
    () => ({
      token,
      user,
      meta,
      disclaimer: meta?.disclaimer ?? FALLBACK_DISCLAIMER,
      login,
      logout,
    }),
    [token, user, meta, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
