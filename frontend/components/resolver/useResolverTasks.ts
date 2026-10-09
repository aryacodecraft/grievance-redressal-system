"use client";

import { useEffect, useState } from "react";
import type { Grievance } from "@/lib/types";
import { listResolverTasks } from "@/lib/resolverTasks";
import { useDemoUser } from "@/lib/session";

export function useResolverTasks(enabled = true) {
  const { user, liveMode } = useDemoUser();
  const [snapshot, setSnapshot] = useState<{ userId: string; items: Grievance[]; loading: boolean; error: string }>({ userId: "", items: [], loading: true, error: "" });

  useEffect(() => {
    if (!enabled || !user || !liveMode) return;
    let active = true;
    const load = async () => {
      try {
        const tasks = await listResolverTasks();
        if (active) setSnapshot({ userId: user.id, items: tasks, loading: false, error: "" });
      } catch (cause) {
        if (active) setSnapshot({ userId: user.id, items: [], loading: false, error: cause instanceof Error ? cause.message : "Could not load assigned tasks" });
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [enabled, liveMode, user]);

  const currentSnapshot = enabled && liveMode && user?.id === snapshot.userId;
  return { items: currentSnapshot ? snapshot.items : [], loading: enabled && liveMode && Boolean(user) && (!currentSnapshot || snapshot.loading), error: currentSnapshot ? snapshot.error : "", refresh: async () => {
    if (!user) return;
    try { setSnapshot({ userId: user.id, items: await listResolverTasks(), loading: false, error: "" }); }
    catch (cause) { setSnapshot({ userId: user.id, items: [], loading: false, error: cause instanceof Error ? cause.message : "Could not load assigned tasks" }); }
  } };
}
