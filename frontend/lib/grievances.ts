"use client";

import { getGrievance, listGrievances } from "./api";
import { isAdminEmail } from "./roles";
import type { Grievance } from "./types";

export interface SubscribeOptions {
  /** Poll interval in ms. */
  intervalMs?: number;
  /** Force scoping to a specific user (true = citizen's own, false = all grievances for admin). */
  scopeToUser?: boolean;
}

/**
 * Polling replacement for Firestore onSnapshot. Admins receive the
 * global newest-first list; citizens receive only their own grievances.
 * Returns an unsubscribe function compatible with useEffect cleanup.
 */
export function subscribeGrievances(
  userId: string,
  email: string | null,
  onData: (items: Grievance[]) => void,
  onError: (message: string) => void,
  { intervalMs = 15000, scopeToUser }: SubscribeOptions = {}
): () => void {
  let cancelled = false;

  const load = async () => {
    try {
      const shouldScope =
        scopeToUser !== undefined ? scopeToUser : !isAdminEmail(email);
      const items = await listGrievances(shouldScope ? { userId } : {});
      if (!cancelled) onData(items);
    } catch (err) {
      if (!cancelled) {
        onError(
          err instanceof Error ? err.message : "Failed to load grievances."
        );
      }
    }
  };

  void load();
  const timer = setInterval(() => void load(), intervalMs);

  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}

/** Single-grievance lookup for the Track page. */
export async function fetchGrievanceById(id: string): Promise<Grievance | null> {
  return getGrievance(id);
}
