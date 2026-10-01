"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useDemoUser } from "@/lib/session";
import { roleForEmail } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const { signInDemo } = useDemoUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Dev-only credential hint. Visible only when NEXT_PUBLIC_SHOW_DEV_CREDS
  // is "true" (local .env.local). Remove before any shared deployment.
  const showDevCreds = process.env.NEXT_PUBLIC_SHOW_DEV_CREDS === "true";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    const role = roleForEmail(email);
    signInDemo(email, role);
    router.push(role === "admin" ? "/admin" : "/submit");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <Card>
        <CardHeader
          title="Sign in"
          subtitle="Official portal access for citizens and officers."
        />
        <CardBody>
          {showDevCreds && (
            <div className="mb-4 rounded-md border border-dashed border-ink-400 bg-ink-50 p-3 text-xs text-ink-700 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-300">
              <p className="font-semibold uppercase tracking-wider">
                Dev credentials — remove before sharing
              </p>
              <p className="mt-1 font-mono">admin@grievai.test / any password</p>
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
          <form onSubmit={submit} className="space-y-4">
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
            <Button type="submit" size="lg" className="w-full">
              Sign in
            </Button>
          </form>
          <Alert>
            Demo mode: any email works. Use an address containing “admin” to
            preview the admin dashboard.
          </Alert>
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
