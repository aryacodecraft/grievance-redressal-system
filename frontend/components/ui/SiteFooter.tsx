export function SiteFooter() {
  return (
    <footer className="border-t border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <p className="text-sm font-bold text-ink-900 dark:text-white">
            GrievAI — National Grievance Redressal Portal
          </p>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
            An academic research prototype demonstrating AI-assisted grievance
            categorization with human-in-the-loop decision making.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            Citizen services
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink-500 dark:text-ink-400">
            <li>Register a grievance</li>
            <li>Track grievance status</li>
            <li>View resolution timeline</li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">
            Accountability
          </p>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
            AI provides recommendations only. Assignment, escalation, and
            closure always require an authorized human decision.
          </p>
        </div>
      </div>
      <div className="border-t border-ink-200 py-4 dark:border-ink-800">
        <p className="mx-auto max-w-6xl px-4 text-xs text-ink-400 sm:px-6">
          Prototype — not an official government service.
        </p>
      </div>
    </footer>
  );
}
