"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useDemoUser } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const { signInDemo, signInFirebase, firebaseReady } = useDemoUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Dev-only credential hint. Visible only when NEXT_PUBLIC_SHOW_DEV_CREDS
  // is "true" (local .env.local). Remove before any shared deployment.
  const showDevCreds =
    process.env.NEXT_PUBLIC_SHOW_DEV_CREDS === "true";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (firebaseReady) {
        await signInFirebase(email, password);
        router.push(
          email.toLowerCase().includes("admin") ? "/admin" : "/submit"
        );
      } else {
        const role = email.toLowerCase().includes("admin") ? "admin" : "citizen";
        signInDemo(email, role);
        router.push(role === "admin" ? "/admin" : "/submit");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Live sign-in failed: ${err.message}`
          : "Live sign-in failed."
      );
    } finally {
      setBusy(false);
    }
  }

  function continueDemo() {
    const role = email.toLowerCase().includes("admin") ? "admin" : "citizen";
    signInDemo(email || "demo@example.in", role);
    router.push(role === "admin" ? "/admin" : "/submit");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <Card>
        <CardHeader
          title="Sign in"
          subtitle={
            firebaseReady
              ? "Live sign-in — unlocks your real grievances and the admin queue."
              : "Official portal access for citizens and officers."
          }
        />
        <CardBody>
          {showDevCreds && (
            <div className="mb-4 rounded-md border border-dashed border-ink-400 bg-ink-50 p-3 text-xs text-ink-700 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-300">
              <p className="font-semibold uppercase tracking-wider">
                Dev credentials — remove before sharing
              </p>
              <p className="mt-1 font-mono">admin@grievai.test / Admin@2026</p>
              <button
                type="button"
                className="mt-2 font-medium text-primary-700 underline hover:text-primary-800 dark:text-primary-300"
                onClick={() => {
                  setEmail("admin@grievai.test");
                  setPassword("Admin@2026");
                }}
              >
                Autofill admin credentials
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(e);
            }}
            className="space-y-4"
          >
            <Field label="Email address" required>
              <Input
                type="email"
                placeholder="you@example.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            {firebaseReady && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={continueDemo}
              >
                Continue with demo instead
              </Button>
            )}
          </form>
          {!firebaseReady && (
            <Alert>
              Demo mode: any email works. Use an address containing “admin”
              to preview the admin dashboard.
            </Alert>
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
