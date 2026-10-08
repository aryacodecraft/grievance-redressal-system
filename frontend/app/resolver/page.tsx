"use client";

import { ResolverGate } from "@/components/resolver/ResolverGate";
import { ResolverWorkspace } from "@/components/resolver/ResolverWorkspace";

export default function ResolverPage() {
  return <ResolverGate><div className="min-h-[calc(100vh-4rem)] bg-ink-50/40 px-4 py-8 sm:px-6 lg:px-8"><div className="mb-6"><h1 className="text-2xl font-bold">Resolver workbench</h1><p className="mt-1 text-sm text-ink-500">Work only on grievances assigned to your department account.</p></div><ResolverWorkspace /></div></ResolverGate>;
}
