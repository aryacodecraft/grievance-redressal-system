export function SiteFooter() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-600 text-xs font-bold text-white">
              G
            </span>
            <p className="text-sm font-bold text-ink-900">
              GrievAI
            </p>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-500">
            An academic research prototype demonstrating AI-assisted grievance
            categorization with human-in-the-loop decision making.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
            Citizen Services
          </p>
          <ul className="mt-3 space-y-2 text-xs text-ink-500">
            <li className="hover:text-ink-800 transition-colors">Register a public grievance</li>
            <li className="hover:text-ink-800 transition-colors">Track grievance status & timeline</li>
            <li className="hover:text-ink-800 transition-colors">Officer assignment & verification</li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
            Accountability & Safety
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            AI provides recommendation only. Assignment, escalation, and closure
            always require an authorized human decision.
          </p>
        </div>
      </div>
      <div className="border-t border-ink-100 py-4 bg-white">
        <p className="mx-auto max-w-6xl px-4 text-xs text-ink-400 sm:px-6">
          © {new Date().getFullYear()} GrievAI Research Prototype — AI decision support system.
        </p>
      </div>
    </footer>
  );
}
