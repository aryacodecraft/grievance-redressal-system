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
  const { signInDemo } = useDemoUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    // Demo session — Firebase / OAuth wiring is a follow-up.
    const role = email.toLowerCase().includes("admin") ? "admin" : "citizen";
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
            <Alert>
              Demo mode: any email works. Use an address containing “admin”
              to preview the admin dashboard.
            </Alert>
            <Button type="submit" size="lg" className="w-full">
              Sign in
            </Button>
          </form>
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
