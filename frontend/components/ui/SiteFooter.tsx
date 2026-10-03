export function SiteFooter() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <div className="grid gap-8 px-4 py-10 sm:px-6 lg:px-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary-600 text-xs font-bold text-white">
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
            <li className="hover:text-ink-800 transition-colors">Track grievance status &amp; timeline</li>
            <li className="hover:text-ink-800 transition-colors">Officer assignment &amp; verification</li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
            Accountability &amp; Safety
          </p>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            AI provides recommendation only. Assignment, escalation, and closure
            always require an authorized human decision.
          </p>
        </div>
      </div>
      <div className="border-t border-ink-100 py-4 bg-white">
        <p className="px-4 text-xs text-ink-400 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} GrievAI Research Prototype — AI decision support system.
        </p>
      </div>
    </footer>
  );
}
