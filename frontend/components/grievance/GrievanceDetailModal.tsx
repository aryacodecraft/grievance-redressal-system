"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { GrievanceDetailPanel } from "./GrievanceDetailPanel";
import type { Grievance } from "@/lib/types";

export function GrievanceDetailModal({
  grievance,
  onClose,
}: {
  grievance: Grievance | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!grievance) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-2 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Grievance details: ${grievance.id}`}
      onClick={onClose}
    >
      <div
        className="my-2 sm:my-4 w-full max-w-3xl rounded-xl border border-ink-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <GrievanceDetailPanel
          key={grievance.id}
          grievance={grievance}
          headerAction={
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="shrink-0 rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <X size={20} />
            </button>
          }
        />

        {/* Modal Footer */}
        <div className="border-t border-ink-100 bg-ink-50/50 px-4 py-3 sm:px-6 sm:py-3.5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-md border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 shadow-2xs hover:bg-ink-50 active:bg-ink-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
