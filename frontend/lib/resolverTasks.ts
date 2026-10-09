import { getGrievance, listAssignedResolverTasks, listGrievances, listNotifications } from "./api";
import type { Grievance } from "./types";

type TaskNotification = { kind?: string; entityId?: string };

/**
 * Load the authenticated resolver queue, then recover any missing queue rows
 * from that user's assignment notifications. The detail endpoint independently
 * verifies ownerId, so notifications cannot grant access to another employee's
 * grievance.
 */
export async function listResolverTasks(): Promise<Grievance[]> {
  const [queueResult, notificationsResult] = await Promise.allSettled([
    listAssignedResolverTasks().catch((error: unknown) => {
      // Older backend deployments do not expose the dedicated queue route.
      if (error instanceof Error && /\(404\)/.test(error.message)) return listGrievances();
      throw error;
    }),
    listNotifications(),
  ]);

  const queueError = queueResult.status === "rejected" ? queueResult.reason : null;
  const notificationError = notificationsResult.status === "rejected" ? notificationsResult.reason : null;
  if (queueError && notificationError) {
    throw queueError instanceof Error ? queueError : new Error("Could not load assigned tasks");
  }

  const queue = queueResult.status === "fulfilled" ? queueResult.value : [];
  const notifications = notificationsResult.status === "fulfilled"
    ? notificationsResult.value as TaskNotification[]
    : [];
  const taskIds = [...new Set(notifications
    .filter((notification) => notification.kind === "grievance.assigned_to_you" && notification.entityId)
    .map((notification) => notification.entityId!))];
  const presentIds = new Set(queue.map((task) => task.id));
  const missingIds = taskIds.filter((id) => !presentIds.has(id));
  const recovered = await Promise.allSettled(missingIds.map((id) => getGrievance(id)));
  const merged = new Map(queue.map((task) => [task.id, task]));
  for (const result of recovered) {
    if (result.status === "fulfilled" && result.value) merged.set(result.value.id, result.value);
  }
  return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
