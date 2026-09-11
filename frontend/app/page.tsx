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
  "Roads",
  "Water",
  "Electricity",
  "Sanitation",
  "Health",
  "Education",
  "Transport",
  "Other",
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="border-b border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-900">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
          <div>
            <Badge tone="blue">Official citizen portal</Badge>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink-900 md:text-5xl dark:text-white">
              GrievAI — National Grievance Redressal Portal
            </h1>
            <p className="mt-4 max-w-lg text-lg text-ink-500 dark:text-ink-400">
              The single place to register public grievances. Your complaint is
              recorded, categorized, and routed — and you can track every step
              to resolution.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/submit"
                className="rounded-md bg-primary-700 px-6 py-3 text-sm font-medium text-white hover:bg-primary-800"
              >
                Register Complaint
              </Link>
              <Link
                href="/track"
                className="rounded-md border border-ink-300 bg-white px-6 py-3 text-sm font-medium text-ink-900 hover:border-primary-600 hover:text-primary-700 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-100"
              >
                Track Status
              </Link>
            </div>
            <p className="mt-4 text-xs text-ink-400">
              Research prototype — AI recommends, officers decide.
            </p>
          </div>
          <Card className="self-center">
            <div className="border-b border-ink-200 bg-primary-700 px-5 py-3 dark:border-ink-800">
              <p className="text-sm font-semibold text-white">
                Grievance at a glance
              </p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-ink-200 text-center dark:divide-ink-800">
              {[
                ["1,284", "Registered"],
                ["962", "Resolved"],
                ["75%", "Resolution rate"],
              ].map(([v, l]) => (
                <div key={l} className="px-2 py-5">
                  <p className="text-2xl font-bold text-ink-900 dark:text-white">
                    {v}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-ink-500">
                    {l}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-white">
          How it works
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <Card key={s.n}>
              <CardBody>
                <p className="text-sm font-bold text-primary-600 dark:text-primary-300">
                  {s.n}
                </p>
                <h3 className="mt-2 text-base font-semibold text-ink-900 dark:text-white">
                  {s.title}
                </h3>
                <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                  {s.text}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="border-t border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-white">
            Departments covered
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Badge key={c} tone="outline" className="px-4 py-1.5 text-sm">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
