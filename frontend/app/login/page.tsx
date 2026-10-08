"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  BrainCircuit,
  MapPin,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { useDemoUser } from "@/lib/session";
import { roleForEmail } from "@/lib/roles";
import { TEST_ACCOUNTS } from "@/lib/testAccounts";
import { getGoogleAuthUrl } from "@/lib/api";

const REMEMBER_KEY = "grievai.remembered-email";

const highlights = [
  {
    Icon: BrainCircuit,
    title: "AI-assisted triage",
    text: "Automatic categorization and priority routing.",
  },
  {
    Icon: MapPin,
    title: "Location-aware reporting",
    text: "Pin issues on a live map for faster dispatch.",
  },
  {
    Icon: ShieldCheck,
    title: "Audited accountability",
    text: "Every status change is verified and logged.",
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInDemo, login, liveMode } = useDemoUser();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initial state read lazily so the remembered email is present on the
  // very first client render. Guarded for SSR, where window is undefined.
  const [initialEmail] = useState(() =>
    typeof window === "undefined" ? "" : (window.localStorage.getItem(REMEMBER_KEY) ?? "")
  );
  const [email, setEmail] = useState(initialEmail);
  const [remember, setRemember] = useState(initialEmail !== "");

  const urlError = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    urlError
      ? urlError === "google_denied"
        ? "Google authentication was cancelled."
        : urlError === "google_token_failed" || urlError === "no_id_token"
          ? "Failed to verify credentials with Google."
          : `Sign in error: ${urlError}`
      : null
  );

  // Dev-only credential hint. Visible only when NEXT_PUBLIC_SHOW_DEV_CREDS
  // is "true" (local .env.local). Remove before any shared deployment.
  const showDevCreds = process.env.NEXT_PUBLIC_SHOW_DEV_CREDS === "true";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter your email and password.");
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
        const role = user.role.toUpperCase();
        if (role === "ADMIN" || role === "SUPERADMIN") {
          router.push("/admin");
        } else {
          router.push("/submit");
        }
      } else {
        const role = roleForEmail(email);
        signInDemo(email, role);
        router.push(role === "admin" ? "/admin" : "/submit");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoogleLogin() {
    window.location.href = getGoogleAuthUrl();
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Left branding panel */}
      <div className="relative hidden flex-shrink-0 overflow-hidden bg-ink-950 text-white lg:flex lg:w-[440px] xl:w-[500px] lg:flex-col lg:justify-between px-12 py-14">
        {/* Decorative dot grid + primary glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-600/25 blur-3xl"
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary-600 font-bold text-white shadow-xs">
              G
            </span>
            <span className="text-base font-bold tracking-tight">GrievAI</span>
          </div>

          <h2 className="mt-10 text-3xl font-extrabold tracking-tight leading-[1.2]">
            Transparent grievance resolution, powered by AI.
          </h2>
          <p className="mt-4 text-sm text-ink-400 leading-relaxed">
            Submit, track, and resolve public complaints with AI-assisted
            categorization and authorized officer oversight.
          </p>

          <div className="mt-10 space-y-5 border-t border-white/10 pt-8">
            {highlights.map(({ Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-white/5 text-primary-300 ring-1 ring-white/10">
                  <Icon size={17} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-400">
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-ink-500 font-medium">
          National Public Grievance Redressal and Citizen Support System.
        </p>
      </div>

      {/* Right: login form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-8 lg:px-16">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-700 ring-1 ring-primary-200">
              <ShieldCheck size={12} strokeWidth={2} />
              Secure portal
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-950">
              Sign in
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              {liveMode
                ? "Official portal access for citizens and officers."
                : "Sign in with your official account credentials."}
            </p>
          </div>

          {showDevCreds && (
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

          {error && (
            <div className="mb-5">
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <Field label="Email address" required>
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
            <Field label="Password" required>
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                  className="h-3.5 w-3.5 rounded border-ink-300 accent-primary-600"
                />
                Remember me
              </label>
              <Link
                href="mailto:support@grievai.gov.in?subject=Password%20reset%20request"
                className="text-xs font-medium text-primary-700 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
              {!isSubmitting && <ArrowRight size={16} strokeWidth={2} />}
            </Button>
          </form>

          {liveMode && (
            <div className="mt-5">
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-ink-200" />
                </div>
                <span className="relative bg-white px-2 text-xs uppercase text-ink-500">
                  Or continue with
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
                Sign in with Google
              </Button>
            </div>
          )}

          {!liveMode && (
            <div className="mt-5">
              <Alert>
                Demo mode: any email works. Use an address containing &quot;admin&quot; to
                preview the admin dashboard.
              </Alert>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-ink-500">
            New here?{" "}
            <Link
              href="/register"
              className="font-medium text-primary-700 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
