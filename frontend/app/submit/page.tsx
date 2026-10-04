import type { Metadata } from "next";
import { SubmitForm } from "@/components/grievance/SubmitForm";
import { MyGrievances } from "@/components/grievance/MyGrievances";

export const metadata: Metadata = { title: "Register Complaint" };

export default function SubmitPage() {
  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      {/* Page header — full bleed */}
      <div className="border-b border-ink-100 bg-ink-50/50 px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-xl font-bold tracking-tight text-ink-950">
          Register a Public Grievance
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Describe the issue, attach evidence, and pin your location. AI-assisted routing ensures your
          complaint reaches the right department.
        </p>
      </div>

      {/* Two-column layout: form left, my grievances right */}
      <div className="grid gap-0 lg:grid-cols-[1fr_380px] min-h-[calc(100vh-8rem)]">
        {/* Left: submit form */}
        <div className="border-r border-ink-100 px-4 py-8 sm:px-6 lg:px-8">
          <SubmitForm />
        </div>

        {/* Right: citizen's grievance history sidebar */}
        <div className="bg-ink-50/30 px-4 py-8 sm:px-6">
          <MyGrievances />
        </div>
      </div>
    </div>
  );
}
