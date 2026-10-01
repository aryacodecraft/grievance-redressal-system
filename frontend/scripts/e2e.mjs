// End-to-end check: drives the REAL frontend API client (`lib/api.ts`, zod
// parsing included) against a live FastAPI backend + MongoDB — i.e. the
// migration plan's Phase 6 "submit → track → admin view" path minus the DOM.
//
// Usage (backend must already be running):
//   NEXT_PUBLIC_API_URL=http://localhost:10000 node frontend/scripts/e2e.mjs
//
// Mocking lives in the React hooks, not in `lib/api.ts`, so these calls always
// hit the network — that is what makes this a genuine contract test.
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:10000";
process.env.NEXT_PUBLIC_USE_MOCKS = "false";

const api = await import("../lib/api.ts");

const log = (step, detail = "") =>
  console.log(`  ok  ${step}${detail ? ` — ${detail}` : ""}`);

// 1. Health -----------------------------------------------------------------
assert.equal(await api.checkBackendHealth(), true, "backend unreachable");
log("checkBackendHealth", "true");

// 2. Citizen submits --------------------------------------------------------
const payload = {
  title: "Water logging under the flyover",
  description:
    "Water logging under the flyover after every rain, vehicles stall and traffic backs up for hours.",
  userId: "e2e-citizen",
  latitude: 18.5204,
  longitude: 73.8567,
};
const result = await api.submitGrievance(payload);
assert.match(result.grievanceId, /^GRV-\d{4}-\d{4}$/);
assert.ok(result.message, "missing message");
log("submitGrievance", `${result.grievanceId}`);

// 3. Citizen tracks it (zod-parsed single read) -----------------------------
const tracked = await api.getGrievance(result.grievanceId);
assert.ok(tracked, "submit -> get returned null");
assert.equal(tracked.title, payload.title);
assert.equal(tracked.userId, payload.userId);
assert.equal(tracked.status, "open");
assert.ok(tracked.createdAt, "createdAt missing");
log("getGrievance (track)", `status=${tracked.status} category=${tracked.category}`);

// 4. Unknown id -> null (the track page's not-found path) -------------------
assert.equal(await api.getGrievance("GRV-1999-9999"), null);
log("getGrievance unknown id", "null");

// 5. Admin lists the global queue + citizen-scoped list ---------------------
const all = await api.listGrievances();
assert.ok(all.length >= 1, "admin queue empty");
const mine = await api.listGrievances({ userId: payload.userId });
assert.ok(mine.every((g) => g.userId === payload.userId), "scope leaked");
const nobody = await api.listGrievances({ userId: "does-not-exist" });
assert.deepEqual(nobody, [], "unknown user not empty");
log("listGrievances", `all=${all.length} scoped=${mine.length} unknown=${nobody.length}`);

// 6. Admin assigns + resolves ----------------------------------------------
const assigned = await api.updateGrievanceStatus(result.grievanceId, {
  status: "assigned",
  assignee: "Drainage Cell — Zone 3",
});
assert.equal(assigned.status, "assigned");
assert.equal(assigned.assignee, "Drainage Cell — Zone 3");
assert.equal(assigned.title, payload.title, "PATCH clobbered other fields");

const resolved = await api.updateGrievanceStatus(result.grievanceId, {
  status: "resolved",
});
assert.equal(resolved.status, "resolved");
assert.equal(resolved.assignee, "Drainage Cell — Zone 3", "PATCH dropped assignee");

// 7. Admin re-reads: both actions must be persisted -------------------------
const reloaded = await api.getGrievance(result.grievanceId);
assert.equal(reloaded.status, "resolved");
assert.equal(reloaded.assignee, "Drainage Cell — Zone 3");
log("updateGrievanceStatus + admin re-read", "assigned -> resolved, persisted");

// 8. Error propagation (the UI's error banner path) -------------------------
await assert.rejects(
  () =>
    api.submitGrievance({ title: "no user id" }),
  (err) => {
    assert.match(err.message, /userId|required/i, `unexpected error: ${err.message}`);
    return true;
  },
  "submit without userId should reject"
);
log("submitGrievance error", "rejects with the backend's {error} message");

// 9. Second citizen, to prove the admin queue is genuinely multi-user -------
await api.submitGrievance({
  title: "Streetlight dead on MG Road",
  description: "The streetlight near the bus stop has been dark for three weeks.",
  userId: "e2e-citizen-2",
});
const queue = await api.listGrievances();
assert.ok(queue.length >= 2, "queue should have >= 2 after second submit");
assert.equal(new Set(queue.map((g) => g.userId)).size >= 2, true, "single user");
log("second citizen + admin queue", `${queue.length} items, ${new Set(queue.map(g => g.userId)).size} users`);

console.log("\nE2E PASSED: submit -> track -> admin view (real client, zod-validated)");
console.log(`grievance under test: ${result.grievanceId}`);
