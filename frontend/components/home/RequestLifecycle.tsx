"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, FileText, Search, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";

const stages = [
  { label: "Submitted", short: "You report it", text: "Share what happened, add a photo, and pin the exact location.", Icon: FileText },
  { label: "Reviewed", short: "We understand it", text: "AI-assisted triage suggests the category and urgency for officer review.", Icon: Search },
  { label: "Assigned", short: "A team takes it", text: "An authorized department manager routes your request to the right officer.", Icon: ClipboardCheck },
  { label: "In progress", short: "Work begins", text: "The assigned team records updates, next steps, and expected timing.", Icon: ShieldCheck },
  { label: "Resolved", short: "You see the outcome", text: "The resolution is reviewed and the final status remains visible to you.", Icon: CheckCircle2 },
];

export function RequestLifecycle() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % stages.length), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const current = stages[active];
  return (
    <section className="border-b border-ink-100 bg-ink-50/60">
      <div className="px-4 py-14 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-700">A clear path from report to resolution</span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">Know what happens next</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ink-600">Your request moves through a visible lifecycle. AI helps officers organize the queue; people remain responsible for assignment, action, and closure.</p>
        </div>

        <div className="mx-auto mt-10 max-w-6xl">
          <div className="relative px-2 sm:px-8">
            <div className="absolute left-8 right-8 top-5 hidden h-1 rounded-full bg-ink-200 sm:block" aria-hidden="true" />
            <div className="absolute left-8 top-5 hidden h-1 rounded-full bg-primary-600 transition-all duration-700 sm:block" style={{ width: `calc(${(active / (stages.length - 1)) * 100}% - ${active === stages.length - 1 ? 0 : 16}px)` }} aria-hidden="true" />
            <div className="relative grid gap-4 sm:grid-cols-5 sm:gap-2">
              {stages.map(({ label, short, Icon }, index) => {
                const selected = index === active;
                const complete = index <= active;
                return <button key={label} type="button" onClick={() => setActive(index)} className="group flex items-center gap-3 text-left sm:block sm:text-center" aria-label={`Show lifecycle stage: ${label}`}>
                  <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all sm:mx-auto ${complete ? "border-primary-600 bg-primary-600 text-white" : "border-ink-300 bg-white text-ink-400"} ${selected ? "ring-4 ring-primary-100" : ""}`}><Icon size={17} /></span>
                  <span className={`mt-2 block text-xs font-bold ${selected ? "text-primary-700" : "text-ink-700"}`}>{label}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-500 sm:hidden">{short}</span>
                </button>;
              })}
            </div>
          </div>

          <Card className="mx-auto mt-8 max-w-2xl border-primary-200 bg-white shadow-sm"><CardBody className="flex items-start gap-4 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700"><current.Icon size={19} /></span><div><p className="text-[11px] font-bold uppercase tracking-wider text-primary-700">Stage {active + 1} of {stages.length}</p><h3 className="mt-1 text-base font-bold text-ink-950">{current.label}: {current.short}</h3><p className="mt-1 text-sm leading-6 text-ink-600">{current.text}</p></div></CardBody></Card>
        </div>
      </div>
    </section>
  );
}
