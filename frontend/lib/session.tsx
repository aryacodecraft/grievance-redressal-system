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
import {
  clearStoredTokens,
  FaceTwoFactorRequiredError,
  getCurrentUser,
  getStoredAccessToken,
  isFacePending,
  loginUser,
  registerUser,
  setStoredTokens,
  useMocks,
} from "./api";
import type { AuthResponse, AuthUser } from "./types";

export type DemoUser = AuthUser;

const STORAGE_KEY = "grievai-demo-user";

interface Session {
  user: AuthUser | null;
  /** True when the app talks to the real backend (NEXT_PUBLIC_USE_MOCKS=false). */
  liveMode: boolean;
  isLoading: boolean;
  signInDemo: (email: string, role?: AuthUser["role"], name?: string) => void;
  /** Throws FaceTwoFactorRequiredError when the backend pauses for the face step. */
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name: string) => Promise<AuthUser>;
  setAuthSession: (user: AuthUser, accessToken: string, refreshToken?: string) => void;
  /** Store a full token pair + profile in one step (face login / 2FA completion). */
  applyAuthResponse: (res: AuthResponse) => AuthUser;
  signOut: () => void;
}

const DemoUserContext = createContext<Session | null>(null);

export function DemoUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const liveMode = !useMocks();

  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      if (liveMode) {
        const token = getStoredAccessToken();
        if (token) {
          try {
            const profile = await getCurrentUser();
            if (isMounted && profile) {
              const authUser: AuthUser = {
                id: profile.id,
                email: profile.email || null,
                phone: profile.phone || null,
                phoneVerifiedAt: profile.phoneVerifiedAt || null,
                phoneVerifiedMethod: profile.phoneVerifiedMethod || null,
                smsConsent: profile.smsConsent === true,
                smsOptOutAt: profile.smsOptOutAt || null,
                citizen_id: profile.citizen_id || null,
                name:
                  profile.full_name ||
                  (profile.email ? profile.email.split("@")[0] : profile.citizen_id || "User"),
                role: profile.role,
                avatarUrl: profile.avatar_url,
                departmentId: profile.departmentId,
                authMethod: profile.auth_method,
              };
              setUser(authUser);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
            }
          } catch {
            if (isMounted) {
              clearStoredTokens();
              localStorage.removeItem(STORAGE_KEY);
              setUser(null);
            }
          }
        } else {
          // If no token, check if there's any stale user object
          localStorage.removeItem(STORAGE_KEY);
        }
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw && isMounted) {
            setUser(JSON.parse(raw) as AuthUser);
          }
        } catch {
          /* ignore corrupt storage */
        }
      }
      if (isMounted) {
        setIsLoading(false);
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [liveMode]);

  const setAuthSession = useCallback(
    (authUser: AuthUser, accessToken: string, refreshToken?: string) => {
      setStoredTokens(accessToken, refreshToken);
      setUser(authUser);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      } catch {
        /* ignore storage error */
      }
    },
    []
  );

  const applyAuthResponse = useCallback(
    (res: AuthResponse): AuthUser => {
      const authUser: AuthUser = {
        id: res.user.id,
        email: res.user.email || null,
        phone: res.user.phone || null,
        phoneVerifiedAt: res.user.phoneVerifiedAt || null,
        phoneVerifiedMethod: res.user.phoneVerifiedMethod || null,
        smsConsent: res.user.smsConsent === true,
        smsOptOutAt: res.user.smsOptOutAt || null,
        citizen_id: res.user.citizen_id || null,
        name:
          res.user.full_name ||
          res.user.citizen_id ||
          (res.user.email ? res.user.email.split("@")[0] : "Citizen"),
        role: res.user.role,
        avatarUrl: res.user.avatar_url,
        departmentId: res.user.departmentId,
        authMethod: res.user.auth_method,
      };
      setAuthSession(authUser, res.access_token, res.refresh_token);
      return authUser;
    },
    [setAuthSession]
  );

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const res = await loginUser(email, password);
      if (isFacePending(res)) {
        // Privileged account with the optional face step opted in: the caller
        // (login page) must show the 2FA screen — this is not a failure.
        throw new FaceTwoFactorRequiredError(res.pending_token);
      }
      return applyAuthResponse(res);
    },
    [applyAuthResponse]
  );

  const register = useCallback(
    async (email: string, password: string, name: string): Promise<AuthUser> => {
      const res = await registerUser(email, password, name);
      const authUser: AuthUser = {
        id: res.user.id,
        email: res.user.email,
        name: res.user.full_name || name || "User",
        role: res.user.role,
        avatarUrl: res.user.avatar_url,
        departmentId: res.user.departmentId,
      };
      setAuthSession(authUser, res.access_token, res.refresh_token);
      return authUser;
    },
    [setAuthSession]
  );

  const signInDemo = useCallback(
    (email: string, role?: AuthUser["role"], name?: string) => {
      const normalized = email.trim() || "demo@example.in";
      const next: AuthUser = {
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
    clearStoredTokens();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <DemoUserContext.Provider
      value={{
        user,
        liveMode,
        isLoading,
        signInDemo,
        login,
        register,
        setAuthSession,
        applyAuthResponse,
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
