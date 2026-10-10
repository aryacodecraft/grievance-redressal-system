"use client";

import Link from "next/link";
import { useDemoUser } from "@/lib/session";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function ResolverGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useDemoUser();
  if (isLoading) return <div className="p-10 text-sm text-ink-500">Checking access…</div>;
  if (!user || !["RESOLVER", "ADMIN", "SUPERADMIN"].includes(user.role.toUpperCase())) {
    return <div className="mx-auto max-w-lg p-8"><Card><CardBody className="space-y-4 text-center"><h1 className="text-xl font-bold">Employee access required</h1><p className="text-sm text-ink-500">Sign in with your department employee account to view your assigned work.</p><Link href="/login"><Button>Sign in</Button></Link></CardBody></Card></div>;
  }
  return <>{children}</>;
}
