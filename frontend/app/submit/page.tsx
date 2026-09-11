import type { Metadata } from "next";
import { SubmitForm } from "@/components/grievance/SubmitForm";

export const metadata: Metadata = { title: "Register Complaint" };

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-ink-900 dark:text-white">
        Register Complaint
      </h1>
      <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
        Your report is categorized by the system and routed to the responsible
        department. A human officer reviews every assignment.
      </p>
      <div className="mt-6">
        <SubmitForm />
      </div>
    </div>
  );
}
