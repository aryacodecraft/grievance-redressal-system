"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { roleForEmail } from "./roles";
import { useMocks } from "./api";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: "citizen" | "admin";
}

const STORAGE_KEY = "grievai-demo-user";

interface Session {
  user: DemoUser | null;
  /** True when the app talks to the real backend (NEXT_PUBLIC_USE_MOCKS=false). */
  liveMode: boolean;
  signInDemo: (email: string, role?: DemoUser["role"], name?: string) => void;
  signOut: () => void;
}

const DemoUserContext = createContext<Session | null>(null);

/**
 * Demo (localStorage) session provider.
 *
 * Real authentication is out of scope for this pass — see the migration plan.
 * The persisted user is the only identity the app has; the REST API is called
 * with that user's id.
 */
export function DemoUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const liveMode = !useMocks();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as DemoUser);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const signInDemo = useCallback(
    (email: string, role?: DemoUser["role"], name?: string) => {
      const normalized = email.trim() || "demo@example.in";
      const next: DemoUser = {
        id: `demo-${normalized.toLowerCase()}`,
        name: name?.trim() || normalized.split("@")[0] || "Demo User",
        email: normalized,
        role: role ?? roleForEmail(normalized),
      };
      setUser(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    []
  );

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <DemoUserContext.Provider
      value={{ user, liveMode, signInDemo, signOut }}
    >
      {children}
    </DemoUserContext.Provider>
  );
}

export function useDemoUser() {
  const ctx = useContext(DemoUserContext);
  if (!ctx) throw new Error("useDemoUser must be used within DemoUserProvider");
  return ctx;
}
