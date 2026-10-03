"use client";

import Link from "next/link";
import { ShieldAlert, ShieldCheck, Lock } from "lucide-react";
import { AdminBoard } from "@/components/admin/AdminBoard";
import { AdminCharts } from "@/components/charts/AdminCharts";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Feedback";
import { useDemoUser } from "@/lib/session";

export default function AdminPage() {
  const { user, isLoading, signOut } = useDemoUser();

  // 1. Session is still loading from storage / /auth/me
  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-8 bg-white">
        <Spinner label="Verifying administrative privileges…" />
      </div>
    );
  }

  const role = user?.role?.toUpperCase();
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";

  // 2. Unauthenticated user
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

  // 3. Authenticated citizen / non-admin user
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
              You are signed in as <span className="font-semibold text-ink-800">{user.email}</span> (Citizen role).
              Only authorized administrative personnel can access the triage and decision dashboard.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <Link href="/submit" className="w-full">
                <Button className="w-full">Go to Citizen Portal</Button>
              </Link>
              <button
                type="button"
                onClick={() => {
                  signOut();
                  window.location.href = "/login";
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

  // 4. Authorized Admin
  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      {/* Page header — full bleed */}
      <div className="border-b border-ink-100 bg-ink-50/50 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-ink-950">
                Administrative Control Centre
              </h1>
              <span className="inline-flex items-center gap-1 rounded-sm bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-800 border border-primary-200">
                <ShieldCheck size={12} />
                Admin
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-500">
              Triage pending grievances, review AI recommendations, and authorize department assignments.
            </p>
          </div>
          <span className="text-xs text-ink-500">
            Signed in as: <strong className="font-medium text-ink-800">{user.email}</strong>
          </span>
        </div>
      </div>

      {/* Full-width content — no max-w container */}
      <div className="px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <AdminBoard />
        <AdminCharts />
      </div>
    </div>
  );
}
