"use client";

import Link from "next/link";
import { useDemoUser } from "@/lib/session";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function SuperadminGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useDemoUser();
  if (isLoading) return <div className="p-10 text-sm text-ink-500">Checking access…</div>;
  if (!user || user.role.toUpperCase() !== "SUPERADMIN") return <div className="mx-auto max-w-lg p-8"><Card><CardBody className="space-y-4 text-center"><h1 className="text-xl font-bold">Superadmin access required</h1><p className="text-sm text-ink-500">This area controls users, departments, and audit records.</p><Link href="/login"><Button>Sign in</Button></Link></CardBody></Card></div>;
  return <>{children}</>;
}
