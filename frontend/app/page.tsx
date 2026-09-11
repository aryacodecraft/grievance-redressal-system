import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const steps = [
  {
    n: "01",
    title: "Register your grievance",
    text: "Describe the issue, attach a photo, and pin the location. It takes less than two minutes.",
  },
  {
    n: "02",
    title: "AI-assisted triage",
    text: "The system suggests a category and priority so your report reaches the right desk faster.",
  },
  {
    n: "03",
    title: "Track to resolution",
    text: "Follow status changes on a public timeline. Every decision is made by an authorized officer.",
  },
];

const categories = [
  "Water",
  "Roads",
  "Electricity",
  "Sanitation",
  "Health",
  "Governance",
  "Other",
];

export default function Home() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-ink-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-12 md:py-24 items-center">
          <div className="md:col-span-7">
            <Badge tone="blue" className="px-3 py-1 font-semibold">
              Official citizen portal
            </Badge>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-ink-950 sm:text-5xl lg:text-[3.25rem] leading-[1.15]">
              National Grievance Redressal Portal
            </h1>
            <p className="mt-5 max-w-xl text-base text-ink-600 sm:text-lg leading-relaxed font-normal">
              A transparent, accountable platform to register and resolve public
              grievances. AI-assisted categorization and routing with authorized
              officer verification.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/submit"
                className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-xs transition-all hover:bg-primary-700 hover:shadow-sm active:scale-[0.98]"
              >
                Register Complaint
              </Link>
              <Link
                href="/track"
                className="inline-flex items-center justify-center rounded-lg border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-800 shadow-2xs transition-all hover:border-ink-300 hover:bg-ink-50 active:scale-[0.98]"
              >
                Track Status
              </Link>
            </div>
            <div className="mt-6 text-xs text-ink-400">
              <span>Research prototype — AI recommends, officers decide.</span>
            </div>
          </div>
          <div className="md:col-span-5">
            <Card className="overflow-hidden border-ink-200/90 shadow-sm hover:shadow-md transition-shadow">
              <div className="border-b border-ink-100 bg-ink-50/70 px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
                    System Live Statistics
                  </p>
                </div>
                <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                  Active
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-ink-100 text-center bg-white">
                {[
                  ["1,284", "Registered"],
                  ["962", "Resolved"],
                  ["75%", "Resolution rate"],
                ].map(([v, l]) => (
                  <div key={l} className="px-3 py-6">
                    <p className="text-2xl font-bold tracking-tight text-ink-950">
                      {v}
                    </p>
                    <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                      {l}
                    </p>
                  </div>
                ))}
              </div>
              <div className="bg-ink-50/50 border-t border-ink-100 px-6 py-3 text-center">
                <p className="text-xs text-ink-500 font-medium">
                  Average resolution cycle: <span className="font-semibold text-ink-700">4.2 business days</span>
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center max-w-xl mx-auto">
          <Badge tone="grey" className="mb-3">Standard Protocol</Badge>
          <h2 className="text-3xl font-bold tracking-tight text-ink-950">
            How Redressal Works
          </h2>
          <p className="mt-2 text-sm text-ink-500">
            Fast, transparent 3-step lifecycle ensuring accountability from report to closure.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <Card key={s.n} className="border border-ink-200/70 hover:border-primary-200 transition-colors">
              <CardBody className="p-6">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary-700 border border-primary-100">
                  {s.n}
                </span>
                <h3 className="mt-4 text-base font-semibold tracking-tight text-ink-900">
                  {s.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-500">
                  {s.text}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="border-t border-ink-100 bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-ink-950">
                Participating Departments
              </h2>
              <p className="mt-1 text-xs text-ink-500">
                Select from municipal and administrative categories recognized by the classifier.
              </p>
            </div>
            <Link
              href="/submit"
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline"
            >
              Submit in any department &rarr;
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {categories.map((c) => (
              <Badge
                key={c}
                tone="outline"
                className="px-4 py-2 text-xs font-medium hover:border-primary-300 hover:text-primary-700 transition-colors cursor-default"
              >
                {c}
              </Badge>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
