"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Feedback";
import { useDemoUser } from "@/lib/session";

/**
 * Shared authorization wrapper for admin surfaces.
 * Renders the loading / unauthenticated / forbidden states, and only then the
 * authorized children — so every admin page enforces the same access contract.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signOut } = useDemoUser();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-8 bg-white">
        <Spinner label="Verifying administrative privileges…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 sm:p-8 bg-ink-50/50">
        <Card className="w-full max-w-md border-ink-200/90 shadow-sm text-center">
          <CardBody className="p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-amber-50 text-amber-600 border border-amber-200">
              <Lock size={24} />
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-ink-950">
              Authentication Required
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-ink-500">
              The Administrative Control Centre is restricted to authorized municipal officers.
              Please sign in with your administrative credentials to proceed.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <Link href="/login" className="w-full">
                <Button className="w-full">Sign in as Administrator</Button>
              </Link>
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full">
                  Return to Home
                </Button>
              </Link>
            </div>

            <div className="mt-6 border-t border-ink-100 pt-4 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                Default Local Test Admin
              </p>
              <p className="mt-1 font-mono text-xs text-ink-700">
                admin@grievance.local / Admin@2026!
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const role = user.role?.toUpperCase();
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";

  if (!isAdmin) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 sm:p-8 bg-ink-50/50">
        <Card className="w-full max-w-md border-red-200/80 shadow-sm text-center">
          <CardBody className="p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-red-50 text-red-600 border border-red-200">
              <ShieldAlert size={24} />
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-ink-950">
              Administrative Access Restricted
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-ink-500">
              You are signed in as <span className="font-semibold text-ink-800">{user.email || user.citizen_id || user.name}</span> (Citizen role).
              Only authorized municipal officers can open this dashboard.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <Link href="/submit" className="w-full">
                <Button className="w-full">Go to Citizen Portal</Button>
              </Link>
              <button
                type="button"
                onClick={() => {
                  signOut();
                  router.push("/login");
                }}
                className="w-full"
              >
                <Button variant="outline" className="w-full">
                  Sign in with Admin Account
                </Button>
              </button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
