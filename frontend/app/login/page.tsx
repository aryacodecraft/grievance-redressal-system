"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useDemoUser } from "@/lib/session";
import { roleForEmail } from "@/lib/roles";
import { getGoogleAuthUrl } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInDemo, login, liveMode } = useDemoUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      if (err === "google_denied") {
        setError("Google authentication was cancelled.");
      } else if (err === "google_token_failed" || err === "no_id_token") {
        setError("Failed to verify credentials with Google.");
      } else {
        setError(`Sign in error: ${err}`);
      }
    }
  }, [searchParams]);

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
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <Card>
        <CardHeader
          title="Sign in"
          subtitle={
            liveMode
              ? "Official portal access for citizens and officers."
              : "Demo mode access (mock authentication)."
          }
        />
        <CardBody>
          {showDevCreds && (
            <div className="mb-4 rounded-md border border-dashed border-ink-400 bg-ink-50 p-3 text-xs text-ink-700 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-300">
              <p className="font-semibold uppercase tracking-wider">
                Dev credentials (Admin)
              </p>
              <p className="mt-1 font-mono">admin@grievance.local / Admin@2026!</p>
              <button
                type="button"
                className="mt-2 font-medium text-primary-700 underline hover:text-primary-800 dark:text-primary-300"
                onClick={() => {
                  setEmail("admin@grievance.local");
                  setPassword("Admin@2026!");
                }}
              >
                Autofill admin credentials
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <Field label="Email address" required>
              <Input
                type="email"
                placeholder="you@example.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {liveMode && (
            <div className="mt-4">
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-ink-200 dark:border-ink-700" />
                </div>
                <span className="relative bg-white px-2 text-xs uppercase text-ink-500 dark:bg-ink-950">
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
            <div className="mt-4">
              <Alert>
                Demo mode: any email works. Use an address containing “admin” to
                preview the admin dashboard.
              </Alert>
            </div>
          )}

          <p className="mt-4 text-center text-sm text-ink-500">
            New here?{" "}
            <Link
              href="/register"
              className="font-medium text-primary-700 hover:underline dark:text-primary-300"
            >
              Create an account
            </Link>
          </p>
        </CardBody>
      </Card>
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
