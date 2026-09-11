"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { useDemoUser } from "@/lib/session";

export default function RegisterPage() {
  const router = useRouter();
  const { signInDemo } = useDemoUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Fill in all fields to create your account.");
      return;
    }
    signInDemo(email, "citizen");
    router.push("/submit");
  }

  return (
    <div className="bg-white min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 font-bold text-white shadow-xs">
            G
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink-950">
            Create Citizen Account
          </h1>
          <p className="mt-1 text-xs text-ink-500">
            One unified account for registering and tracking your grievances.
          </p>
        </div>

        <Card className="border-ink-200/80 shadow-xs">
          <CardBody className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <Field label="Full Name" required>
                <Input
                  placeholder="Asha Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Email Address" required>
                <Input
                  type="email"
                  placeholder="you@example.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password" required hint="Minimum 8 characters in production.">
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error && <Alert tone="error">{error}</Alert>}
              <Button type="submit" size="lg" className="w-full">
                Create Account
              </Button>
            </form>
            <div className="mt-5 border-t border-ink-100 pt-4 text-center text-xs text-ink-500">
              Already registered?{" "}
              <Link
                href="/login"
                className="font-semibold text-primary-600 hover:text-primary-700 hover:underline"
              >
                Sign in
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
