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
    <div className="bg-white min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 font-bold text-white shadow-xs">
            G
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink-950">
            Sign in to GrievAI
          </h1>
          <p className="mt-1 text-xs text-ink-500">
            Official portal access for citizens and department officers.
          </p>
        </div>

        <Card className="border-ink-200/80 shadow-xs">
          <CardBody className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <Field label="Email Address" required>
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
              <div className="rounded-lg bg-ink-50 p-3 border border-ink-100 text-[11px] text-ink-600">
                <span className="font-semibold text-ink-800">Demo Prototype Mode:</span> Enter any email. Include &quot;admin&quot; in the email (e.g. <span className="font-mono text-primary-700 font-medium">admin@grievai.in</span>) to unlock officer dashboard privileges.
              </div>
              <Button type="submit" size="lg" className="w-full">
                Sign In
              </Button>
            </form>
            <div className="mt-5 border-t border-ink-100 pt-4 text-center text-xs text-ink-500">
              New citizen user?{" "}
              <Link
                href="/register"
                className="font-semibold text-primary-600 hover:text-primary-700 hover:underline"
              >
                Create an account
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
