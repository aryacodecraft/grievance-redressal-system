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
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <Card>
        <CardHeader
          title="Create an account"
          subtitle="One account for registering and tracking grievances."
        />
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Full name" required>
              <Input
                placeholder="Asha Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Email address" required>
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
              Create account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-ink-500">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-medium text-primary-700 hover:underline dark:text-primary-300"
            >
              Sign in
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
