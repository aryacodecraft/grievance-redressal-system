"use client";

import { getGrievance, listGrievances } from "./api";
import { isAdminEmail } from "./roles";
import type { Grievance } from "./types";

export interface SubscribeOptions {
  /** Poll interval in ms. */
  intervalMs?: number;
  /** Force scoping to a specific user (true = citizen's own, false = all grievances for admin). */
  scopeToUser?: boolean;
  departmentId?: string;
}

export type GrievanceSubscription = (() => void) & { refresh: () => Promise<void> };

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
  { intervalMs = 15000, scopeToUser, departmentId }: SubscribeOptions = {}
): GrievanceSubscription {
  let cancelled = false;
  let requestVersion = 0;

  const load = async () => {
    const version = ++requestVersion;
    try {
      const shouldScope =
        scopeToUser !== undefined ? scopeToUser : !isAdminEmail(email);
      const items = await listGrievances(shouldScope ? { userId } : { dept: departmentId });
      if (!cancelled && version === requestVersion) onData(items);
    } catch (err) {
      if (!cancelled && version === requestVersion) {
        onError(
          err instanceof Error ? err.message : "Failed to load grievances."
        );
      }
    }
  };

  void load();
  const timer = setInterval(() => void load(), intervalMs);

  const unsubscribe = (() => {
    cancelled = true;
    clearInterval(timer);
  }) as GrievanceSubscription;
  unsubscribe.refresh = load;
  return unsubscribe;
}

/** Single-grievance lookup for the Track page. */
export async function fetchGrievanceById(id: string): Promise<Grievance | null> {
  return getGrievance(id);
}
