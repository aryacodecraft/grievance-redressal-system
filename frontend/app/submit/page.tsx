"use client";

import { SubmitForm } from "@/components/grievance/SubmitForm";
import { MyGrievances } from "@/components/grievance/MyGrievances";
import Link from "next/link";
import { useDemoUser } from "@/lib/session";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function SubmitPage() {
  const { user, isLoading } = useDemoUser();
  if (isLoading) return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-ink-500">Checking sign-in…</div>;
  if (!user) return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-ink-50/40 px-4 py-12"><Card className="w-full max-w-md text-center"><CardBody className="space-y-4 p-8"><h1 className="text-xl font-bold text-ink-950">Sign in to lodge a complaint</h1><p className="text-sm leading-6 text-ink-600">Your account lets us connect the request to you and show its progress securely.</p><Link href="/login?next=/submit"><Button className="w-full">Sign in to continue</Button></Link><p className="text-xs text-ink-500">New here? You can create an account in under a minute.</p></CardBody></Card></div>;
  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      {/* Page header — full bleed */}
      <div className="border-b border-ink-100 bg-ink-50/50 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
        <h1 className="text-xl font-bold tracking-tight text-ink-950">
          Register a Public Grievance
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Describe the issue, attach evidence, and pin your location. AI-assisted routing ensures your
          complaint reaches the right department.
        </p>
        </div>
      </div>

      {/* Two-column layout: form left, my grievances right */}
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] w-full max-w-6xl gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: submit form */}
        <div className="flex justify-center border-r border-ink-100 px-4 py-8 sm:px-6 lg:justify-end lg:px-8">
          <div className="w-full max-w-3xl">
            <SubmitForm />
          </div>
        </div>

        {/* Right: citizen's grievance history sidebar */}
        <div className="bg-ink-50/30 px-4 py-8 sm:px-6">
          <MyGrievances />
        </div>
      </div>
    </div>
  );
}
