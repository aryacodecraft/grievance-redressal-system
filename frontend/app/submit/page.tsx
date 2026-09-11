import type { Metadata } from "next";
import { SubmitForm } from "@/components/grievance/SubmitForm";

export const metadata: Metadata = { title: "Register Complaint" };

export default function SubmitPage() {
  return (
    <div className="bg-white min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-950">
            Register a Public Grievance
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Provide details of the issue. The system categorizes your grievance and
            routes it to the responsible department for officer action.
          </p>
        </div>
        <SubmitForm />
      </div>
    </div>
  );
}
