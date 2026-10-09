"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  ScanFace,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { FaceCapture } from "@/components/FaceCapture";
import { useDemoUser } from "@/lib/session";
import { roleForEmail } from "@/lib/roles";
import { TEST_ACCOUNTS } from "@/lib/testAccounts";
import {
  FaceTwoFactorRequiredError,
  clearStoredPendingToken,
  completeFacePending,
  faceLogin,
  getGoogleAuthUrl,
  getPublicConfig,
  getStoredPendingToken,
  issueFaceChallenge,
  verifyFaceSecondFactor,
} from "@/lib/api";
import type { FaceChallenge } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

const REMEMBER_KEY = "grievai.remembered-email";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInDemo, login, liveMode, applyAuthResponse } = useDemoUser();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Face auth UI is gated on GET /config — hidden entirely when the backend
  // runs with FACE_AUTH_ENABLED=false (the default).
  const [faceEnabled, setFaceEnabled] = useState(false);
  const [mode, setMode] = useState<"password" | "face">("password");
  const [faceBusy, setFaceBusy] = useState(false);
  const [challenge, setChallenge] = useState<FaceChallenge | null>(null);
  // 2FA step: entered via password login (FaceTwoFactorRequiredError) or the
  // Google callback redirect (?two_factor=face) — both leave a pending token.
  const [pending, setPending] = useState(
    () =>
      typeof window !== "undefined" &&
      searchParams.get("two_factor") === "face" &&
      Boolean(getStoredPendingToken())
  );

  // Initial state read lazily so the remembered email is present on the
  // very first client render. Guarded for SSR, where window is undefined.
  const [initialEmail] = useState(() =>
    typeof window === "undefined" ? "" : (window.localStorage.getItem(REMEMBER_KEY) ?? "")
  );
  const [email, setEmail] = useState(initialEmail);
  const [remember, setRemember] = useState(initialEmail !== "");

  const urlError = searchParams.get("error");
  const nextPath = searchParams.get("next") || "";
  const [error, setError] = useState<string | null>(
    urlError
      ? urlError === "google_denied"
        ? t("errGoogleCancelled")
        : urlError === "google_token_failed" || urlError === "no_id_token"
          ? t("errGoogleFailed")
          : t("errSignIn", { reason: urlError })
      : null
  );

  useEffect(() => {
    if (!liveMode) return;
    let mounted = true;
    void getPublicConfig().then((cfg) => {
      if (mounted && cfg.faceAuthEnabled) setFaceEnabled(true);
    });
    return () => {
      mounted = false;
    };
  }, [liveMode]);

  // Dev-only credential hint. Visible only when NEXT_PUBLIC_SHOW_DEV_CREDS
  // is "true" (local .env.local). Remove before any shared deployment.
  const showDevCreds = process.env.NEXT_PUBLIC_SHOW_DEV_CREDS === "true";

  const errText = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : fallback;

  /** Where a successful live sign-in lands (staff dashboards win over ?next). */
  function targetAfterLogin(role: string): string {
    const upper = role.toUpperCase();
    const staffHome =
      upper === "SUPERADMIN"
        ? "/superadmin"
        : upper === "ADMIN"
          ? "/admin"
          : upper === "RESOLVER"
            ? "/resolver"
            : null;
    const safeNext =
      nextPath.startsWith("/") && nextPath !== "/submit" ? nextPath : null;
    return staffHome ?? safeNext ?? "/submit";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError(t("errEnterCreds"));
      return;
    }
    setError(null);
    setIsSubmitting(true);

    if (remember) {
      window.localStorage.setItem(REMEMBER_KEY, email);
    } else {
      window.localStorage.removeItem(REMEMBER_KEY);
    }

    try {
      if (liveMode) {
        const user = await login(email, password);
        router.push(targetAfterLogin(user.role));
      } else {
        const role = roleForEmail(email);
        signInDemo(email, role);
        const staffHome = role === "superadmin" ? "/superadmin" : role === "resolver" ? "/resolver" : role === "admin" ? "/admin" : null;
        const safeNext = nextPath.startsWith("/") && nextPath !== "/submit" ? nextPath : null;
        router.push(staffHome ?? safeNext ?? "/submit");
      }
    } catch (err) {
      if (err instanceof FaceTwoFactorRequiredError) {
        // Password accepted; the account opted into the face step (DEC-024).
        setPending(true);
        setError(null);
      } else {
        setError(errText(err, t("errInvalidCreds")));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoogleLogin() {
    window.location.href = getGoogleAuthUrl();
  }

  /* ── Face flows (live mode only, flag-gated) ─────────────────────────── */

  async function beginFaceChallenge() {
    setError(null);
    setFaceBusy(true);
    try {
      setChallenge(await issueFaceChallenge());
    } catch (err) {
      setError(errText(err, t("faceUnavailable")));
    } finally {
      setFaceBusy(false);
    }
  }

  async function startFaceSignIn() {
    if (!email) {
      setError(t("errEnterCreds"));
      return;
    }
    await beginFaceChallenge();
  }

  async function onFaceLoginFrames(frames: string[]) {
    if (!challenge) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await faceLogin(email, {
        challenge_id: challenge.challenge_id,
        frames,
      });
      const user = applyAuthResponse(res);
      clearStoredPendingToken();
      router.push(targetAfterLogin(user.role));
    } catch (err) {
      setError(errText(err, t("faceUnavailable")));
      // The challenge was consumed with the attempt — issue a fresh one.
      setChallenge(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onFaceVerifyFrames(frames: string[]) {
    const token = getStoredPendingToken();
    if (!challenge || !token) {
      setPending(false);
      setError(t("errSignIn", { reason: "session expired" }));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await verifyFaceSecondFactor(
        { challenge_id: challenge.challenge_id, frames },
        token
      );
      clearStoredPendingToken();
      const user = applyAuthResponse(res);
      router.push(targetAfterLogin(user.role));
    } catch (err) {
      setError(errText(err, t("faceUnavailable")));
      setChallenge(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Skip path: /auth/complete-pending only succeeds once the account is
   *  locked out of the face endpoint — otherwise it answers 403 and we show
   *  that message; protected routes never accept the pending token. */
  async function skipFaceStep() {
    const token = getStoredPendingToken();
    if (!token) {
      setPending(false);
      setError(t("errSignIn", { reason: "session expired" }));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await completeFacePending(token);
      clearStoredPendingToken();
      const user = applyAuthResponse(res);
      router.push(targetAfterLogin(user.role));
    } catch (err) {
      setError(errText(err, t("faceUnavailable")));
    } finally {
      setIsSubmitting(false);
    }
  }

  function backToSignIn() {
    clearStoredPendingToken();
    setPending(false);
    setChallenge(null);
    setError(null);
  }

  const faceActionPanel = challenge ? (
    <FaceCapture
      key={challenge.challenge_id}
      action={challenge.action}
      onCapture={pending ? onFaceVerifyFrames : onFaceLoginFrames}
      disabled={isSubmitting}
    />
  ) : null;

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? "bg-white text-ink-950 shadow-xs ring-1 ring-ink-200"
        : "text-ink-500 hover:text-ink-800"
    }`;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-ink-50/40 px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-700 ring-1 ring-primary-200">
              <ShieldCheck size={12} strokeWidth={2} />
              {t("securePortal")}
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-950">
              {pending ? t("faceTwoFactorTitle") : t("signIn")}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              {pending
                ? t("faceTwoFactorSub")
                : liveMode
                  ? t("loginSubLive")
                  : t("loginSubDemo")}
            </p>
          </div>

          {!pending && showDevCreds && (
            <div className="mb-5 rounded-sm border border-dashed border-ink-400 bg-ink-50 p-3 text-xs text-ink-700">
              <p className="font-semibold uppercase tracking-wider text-ink-900">
                Dev test credentials
              </p>
              <p className="mt-1 text-[11px] text-ink-500">
                Seeded when the backend runs with SEED_TEST_ACCOUNTS=true.
                Click Autofill to populate the form.
              </p>
              <div className="mt-2 max-h-64 space-y-2.5 overflow-y-auto pr-1">
                {TEST_ACCOUNTS.map((acct) => (
                  <div
                    key={acct.email}
                    className="flex items-center justify-between gap-2 border-b border-ink-200/60 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-ink-900">{acct.label}:</span>{" "}
                      <code className="font-mono text-[11px] break-all">
                        {acct.email}
                      </code>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 font-medium text-primary-700 underline hover:text-primary-800"
                      onClick={() => {
                        setEmail(acct.email);
                        setPassword(acct.password);
                      }}
                    >
                      Autofill
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!pending && faceEnabled && liveMode && (
            <div
              role="tablist"
              aria-label={t("signIn")}
              className="mb-5 grid grid-cols-2 gap-1 rounded-md border border-ink-200 bg-ink-50 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "password"}
                onClick={() => {
                  setMode("password");
                  setChallenge(null);
                  setError(null);
                }}
                className={tabClass(mode === "password")}
              >
                {t("passwordLabel")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "face"}
                onClick={() => {
                  setMode("face");
                  setChallenge(null);
                  setError(null);
                }}
                className={tabClass(mode === "face")}
              >
                {t("faceSignInTab")}
              </button>
            </div>
          )}

          {error && (
            <div className="mb-5">
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          {pending && (
            <div className="space-y-3">
              {faceActionPanel ?? (
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={() => void beginFaceChallenge()}
                  disabled={faceBusy || isSubmitting}
                >
                  <ScanFace size={16} strokeWidth={2} />
                  {faceBusy ? t("loading") : t("faceVerifyBtn")}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void skipFaceStep()}
                disabled={isSubmitting}
              >
                {t("faceSkipBtn")}
              </Button>
              <button
                type="button"
                onClick={backToSignIn}
                className="mx-auto block text-xs font-medium text-ink-500 hover:text-ink-800"
              >
                {t("backToSignIn")}
              </button>
            </div>
          )}

          {!pending && mode === "face" && (
            <div className="space-y-4">
              <Field label={t("emailLabel")} required>
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </Field>
              {faceActionPanel ?? (
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={() => void startFaceSignIn()}
                  disabled={faceBusy || isSubmitting}
                >
                  <ScanFace size={16} strokeWidth={2} />
                  {faceBusy ? t("loading") : t("faceStart")}
                </Button>
              )}
              <p className="text-xs text-ink-500">{t("faceLoginHint")}</p>
            </div>
          )}

          {!pending && mode === "password" && (
          <form onSubmit={submit} className="space-y-4">
            <Field label={t("emailLabel")} required>
              <Input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Field label={t("passwordLabel")} required>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  style={{ paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1.5 text-ink-400 transition-colors hover:text-ink-700"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <div className="flex items-center justify-between gap-3">
              <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-ink-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-ink-300 accent-primary-700"
                />
                {t("rememberMe")}
              </label>
              <Link
                href="mailto:support@grievai.gov.in?subject=Password%20reset%20request"
                className="text-xs font-medium text-primary-700 hover:underline"
              >
                {t("forgotPassword")}
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("btnSigningIn") : t("signIn")}
              {!isSubmitting && <ArrowRight size={16} strokeWidth={2} />}
            </Button>
          </form>
          )}

          {!pending && liveMode && (
            <div className="mt-5">
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-ink-200" />
                </div>
                <span className="relative bg-white px-2 text-xs uppercase text-ink-500">
                  {t("orContinueWith")}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                {t("googleSignIn")}
              </Button>
            </div>
          )}

          {!pending && !liveMode && (
            <div className="mt-5">
              <Alert>
                Demo mode: any email works. Use an address containing &quot;admin&quot; to
                preview the admin dashboard.
              </Alert>
            </div>
          )}

          {!pending && (
            <p className="mt-6 text-center text-sm text-ink-500">
              {t("newHere")}{" "}
              <Link
                href="/register"
                className="font-medium text-primary-700 hover:underline"
              >
                {t("createAccount")}
              </Link>
            </p>
          )}
        </div>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="p-8 text-center">{t("loading")}</div>}>
      <LoginForm />
    </Suspense>
  );
}
