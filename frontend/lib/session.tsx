"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: "citizen" | "admin";
}

const STORAGE_KEY = "grievai-demo-user";

const DemoUserContext = createContext<{
  user: DemoUser | null;
  signInDemo: (email: string, role?: DemoUser["role"]) => void;
  signOut: () => void;
} | null>(null);

export function DemoUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as DemoUser);
    } catch {
      /* ignore */
    }
  }, []);

  const signInDemo = useCallback(
    (email: string, role: DemoUser["role"] = "citizen") => {
      const next: DemoUser = {
        id: `demo-${role}`,
        name: email.split("@")[0] || "Demo User",
        email,
        role,
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
    <DemoUserContext.Provider value={{ user, signInDemo, signOut }}>
      {children}
    </DemoUserContext.Provider>
  );
}

export function useDemoUser() {
  const ctx = useContext(DemoUserContext);
  if (!ctx) throw new Error("useDemoUser must be used within DemoUserProvider");
  return ctx;
}
