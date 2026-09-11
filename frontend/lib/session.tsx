"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  getFirebaseAuth,
  isAdminEmail,
  isFirebaseConfigured,
} from "./firebase";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: "citizen" | "admin";
  /** Set when signed in through Firebase (live data unlocked). */
  live: boolean;
}

const STORAGE_KEY = "grievai-demo-user";

interface Session {
  user: DemoUser | null;
  firebaseUser: FirebaseUser | null;
  firebaseReady: boolean;
  /** Demo session (mock data). */
  signInDemo: (email: string, role?: DemoUser["role"]) => void;
  /** Real Firebase session (live Firestore reads). Throws on failure. */
  signInFirebase: (email: string, password: string) => Promise<void>;
  signUpFirebase: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const DemoUserContext = createContext<Session | null>(null);

function roleFor(email: string | null): DemoUser["role"] {
  return isAdminEmail(email) ? "admin" : "citizen";
}

export function DemoUserProvider({ children }: { children: ReactNode }) {
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDemoUser(JSON.parse(raw) as DemoUser);
    } catch {
      /* ignore */
    }
    const auth = getFirebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => setFirebaseUser(u));
  }, []);

  const signInDemo = useCallback(
    (email: string, role: DemoUser["role"] = "citizen") => {
      const next: DemoUser = {
        id: `demo-${role}`,
        name: email.split("@")[0] || "Demo User",
        email,
        role,
        live: false,
      };
      setDemoUser(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    []
  );

  const signInFirebase = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Live sign-in is not configured.");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    setDemoUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setFirebaseUser(cred.user);
  }, []);

  const signUpFirebase = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Live sign-up is not configured.");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    setDemoUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setFirebaseUser(cred.user);
  }, []);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch {
        /* ignore */
      }
    }
    setFirebaseUser(null);
    setDemoUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Firebase session wins when present; otherwise demo session.
  const user: DemoUser | null = firebaseUser
    ? {
        id: firebaseUser.uid,
        name: firebaseUser.email?.split("@")[0] ?? "Citizen",
        email: firebaseUser.email ?? "",
        role: roleFor(firebaseUser.email),
        live: true,
      }
    : demoUser;

  return (
    <DemoUserContext.Provider
      value={{
        user,
        firebaseUser,
        firebaseReady,
        signInDemo,
        signInFirebase,
        signUpFirebase,
        signOut,
      }}
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
