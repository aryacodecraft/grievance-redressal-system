"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeGrievances, type GrievanceSubscription } from "@/lib/grievances";
import { MOCK_GRIEVANCES } from "@/lib/mock";
import { useDemoUser } from "@/lib/session";
import type { Grievance } from "@/lib/types";

/**
 * Shared grievance feed for the admin surfaces (triage board + analytics).
 *
 * In live mode it subscribes to the global (unscoped) grievance list; in demo
 * mode it falls back to the bundled mock dataset. Centralised here so the
 * queue and analytics pages use one loading/error contract.
 */
export function useAdminGrievanceFeed(scopeToUser = false, enabled = true) {
  const { user, liveMode } = useDemoUser();
  const live = Boolean(enabled && user && liveMode);

  const [liveItems, setLiveItems] = useState<Grievance[] | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const subscriptionRef = useRef<GrievanceSubscription | null>(null);

  const refreshGrievances = useCallback(async () => {
    await subscriptionRef.current?.refresh();
  }, []);

  useEffect(() => {
    if (!live || !user) return;
    const subscription = subscribeGrievances(
      user.id,
      user.email ?? null,
      (data) => {
        setLiveItems(data);
        setLiveError(null);
      },
      (message) => {
        setLiveError(message);
        setLiveItems(null);
      },
      { scopeToUser, departmentId: user.role.toUpperCase() === "ADMIN" ? user.departmentId ?? undefined : undefined }
    );
    subscriptionRef.current = subscription;
    return () => {
      subscription();
      if (subscriptionRef.current === subscription) subscriptionRef.current = null;
    };
  }, [live, user, scopeToUser]);

  const base = live ? liveItems : MOCK_GRIEVANCES;
  const loading = live && liveItems === null && !liveError;

  return {
    items: base ?? [],
    loading,
    error: liveError,
    live,
    user,
    refreshGrievances,
  };
}
