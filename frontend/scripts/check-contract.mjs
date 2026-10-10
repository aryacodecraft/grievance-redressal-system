// Contract checks for the pieces of the frontend that are pure functions or
// schema-parsing code — i.e. everything testable WITHOUT a browser and without
// a backend. Complements `e2e.mjs` (which needs a running backend) by pinning:
//
//   1. `roleForEmail` / `isAdminEmail`  — the demo-auth privilege rules
//   2. `useMocks()`                     — the mock/live switch semantics
//   3. zod schemas vs. the backend's actual JSON — via a stubbed `fetch`
//
// Usage:  node frontend/scripts/check-contract.mjs
//
// Exit code is non-zero on the first failed assertion, so this can gate CI.
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:10000";
process.env.NEXT_PUBLIC_USE_MOCKS = "false";

const roles = await import("../lib/roles.ts");
const api = await import("../lib/api.ts");

const log = (step, detail = "") =>
  console.log(`  ok  ${step}${detail ? ` — ${detail}` : ""}`);

/* ── 1. roleForEmail / isAdminEmail ──────────────────────────────────────── */

// The allowlist is the intended path: seeded privileged accounts resolve to
// their explicit role, never from a substring match.
assert.equal(roles.roleForEmail("admin@grievai.test"), "admin");
assert.equal(roles.roleForEmail("aryaadmin@gmail.com"), "admin");
assert.equal(roles.roleForEmail("superadmin@grievance.local"), "superadmin");
assert.equal(roles.roleForEmail("roads.employee@grievance.local"), "resolver");
log("roleForEmail allowlist");

// Case- and whitespace-insensitive.
assert.equal(roles.roleForEmail("  ADMIN@GrievAI.TEST  "), "admin");
assert.equal(roles.isAdminEmail(" AryaAdmin@Gmail.COM "), true);
log("roleForEmail normalisation");

// Ordinary citizens stay citizens.
assert.equal(roles.roleForEmail("citizen@example.com"), "citizen");
assert.equal(roles.roleForEmail("priya.sharma@city.gov.in"), "citizen");
log("roleForEmail citizen path");

const escalated = [
  "notadmin@example.com",
  "my-admin-tool@example.com",
  "BADADMIN@x.com",
  "administrivia@x.com",
].filter((email) => roles.roleForEmail(email) !== "citizen");
assert.equal(
  escalated.length,
  0,
  `Unexpected privileged role for ${escalated.join(", ")}`
);
log(
  "roleForEmail rejects substring privilege escalation",
  "all unlisted addresses remain citizens"
);

/* ── 2. useMocks() ───────────────────────────────────────────────────────── */

// Common false spellings must all select live mode.
const mockOn = [];
const mockOff = [];
for (const [value, bucket] of [
  [undefined, mockOn],
  ["", mockOn],
  ["0", mockOff],
  ["FALSE", mockOff],
  ["False", mockOff],
  ["no", mockOff],
  ["off", mockOff],
  ["true", mockOn],
  ["false", mockOff],
]) {
  if (value === undefined) delete process.env.NEXT_PUBLIC_USE_MOCKS;
  else process.env.NEXT_PUBLIC_USE_MOCKS = value;
  bucket.push(value);
  assert.equal(api.useMocks(), bucket === mockOn, `useMocks(${JSON.stringify(value)})`);
}
log(
  "useMocks turns OFF only for the exact string 'false'",
  `${mockOn.length} truthy spellings / ${mockOff.length} falsy`
);

/* ── 3. zod schemas vs. backend JSON (stubbed fetch) ─────────────────────── */

let nextResponse = { status: 200, body: {} };

globalThis.fetch = async function fetchStub() {
  const { status, body } = nextResponse;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
};

// A grievance exactly as `backend/app/db.py::to_api()` emits it — including
// `hfEngine` fields the backend adds beyond what the submit route returns.
const backendGrievance = {
  id: "GRV-2026-0001",
  title: "Waterlogged road",
  description: "Water on the main road after rain.",
  userId: "citizen-1",
  status: "open",
  category: "roads",
  priority: "medium",
  createdAt: "2026-10-02T09:15:00+00:00",
  imageUrl: "https://res.cloudinary.com/demo/image/upload/x.jpg",
  imageValidation: { ok: true, llm_score: 78.4, explanation: "sharp, bright" },
  latitude: 18.52,
  longitude: 73.85,
  assignee: "Ward 4 Engineer",
  hfEngine: {
    category: "roads",
    priority: "medium",
    isUrgent: false,
    keywords: ["road", "water"],
    explanation: "Classified from keyword rules.",
    rawCategoryLabel: "Roads and infrastructure",
    categoryConfidence: 0.5,
    urgentMatches: [],
    modelInfo: {
      categoryModel: "MoritzLaurer/deberta-v3-large-zeroshot-v2.0",
      priorityModel: "cardiffnlp/twitter-roberta-base-sentiment-latest",
      groqModel: "openai/gpt-oss-20b",
      hfCategory: "roads",
      hfPriority: "medium",
    },
  },
};

nextResponse = { status: 200, body: [backendGrievance] };
const list = await api.listGrievances();
assert.equal(list.length, 1);
log("listGrievances parses a backend record");

// GrievanceCard.tsx renders `hfEngine.categoryConfidence` ("Confidence 50%").
// z.object() strips undeclared keys, so if the schema forgets the field the
// record still parses — the display just silently vanishes on live data while
// continuing to work in mock mode (mock.ts bypasses zod).
assert.equal(
  list[0].hfEngine.categoryConfidence,
  0.5,
  "hfEngineSchema must declare categoryConfidence — GrievanceCard renders it"
);
log("hfEngine.categoryConfidence survives parsing");

// Same for the other hfEngine fields the card / types.ts expose.
for (const key of ["rawCategoryLabel", "urgentMatches", "modelInfo"]) {
  assert.ok(
    key in list[0].hfEngine,
    `hfEngineSchema must declare ${key} — declared in lib/types.ts HfEngine`
  );
}
log("remaining HfEngine fields survive parsing");

// imageValidation is emitted by to_api() and declared on lib/types.ts, but
// grievanceSchema did not declare it — so detail views could not read the
// stored verdict back.
assert.deepEqual(
  list[0].imageValidation,
  backendGrievance.imageValidation,
  "grievanceSchema must declare imageValidation"
);
log("imageValidation survives parsing");

// getGrievance uses a direct fetch, so it needs its own stub invocation.
nextResponse = { status: 200, body: backendGrievance };
const one = await api.getGrievance("GRV-2026-0001");
assert.equal(one.id, "GRV-2026-0001");
log("getGrievance parses a single record");

// 404 → null (the client's "not found" signal), not a throw.
nextResponse = { status: 404, body: { error: "Grievance not found" } };
assert.equal(await api.getGrievance("GRV-1999-9999"), null);
log("getGrievance returns null on 404");

// hfEngine.priority can arrive null from the backend when no keyword rule hit
// and no LLM is configured; the schema coerces it rather than throwing.
nextResponse = {
  status: 200,
  body: {
    ...backendGrievance,
    hfEngine: { ...backendGrievance.hfEngine, priority: null },
  },
};
const coerced = await api.getGrievance("GRV-2026-0001");
assert.equal(coerced.hfEngine.priority, "low", "null priority must fall back");
log("hfEngine.priority null → 'low'");

// Unknown keys are stripped, not rejected — the backend may add fields
// (imageValidation did) without breaking clients.
nextResponse = {
  status: 200,
  body: { ...backendGrievance, someFutureField: { nested: true } },
};
const stripped = await api.getGrievance("GRV-2026-0001");
assert.ok(!("someFutureField" in stripped));
log("unknown backend fields are stripped, not fatal");

// Required fields really are required: a record without createdAt must fail
// the parse (loudly, not silently) — otherwise a backend change that drops it
// would surface as an empty detail page.
nextResponse = {
  status: 200,
  body: { ...backendGrievance, createdAt: undefined },
};
await assert.rejects(() => api.getGrievance("GRV-2026-0001"), /createdAt/i);
log("missing createdAt is rejected by zod");

// Submit: the response shape the citizen flow depends on.
nextResponse = {
  status: 200,
  body: {
    message: "Grievance submitted successfully",
    grievanceId: "GRV-2026-0002",
    hfEngine: backendGrievance.hfEngine,
  },
};
const submitted = await api.submitGrievance({
  title: "t",
  description: "d",
  userId: "citizen-1",
});
assert.equal(submitted.grievanceId, "GRV-2026-0002");
log("submitGrievance parses submit result");

// /validate-image returns { ok, llm_score, explanation } — the shape
// ImageUpload.tsx reads to decide whether to attach the image.
nextResponse = {
  status: 200,
  body: { ok: true, llm_score: 78.4, explanation: "sharp, bright", threshold: 60 },
};
const verdict = await api.validateImage("https://x/y.jpg");
assert.equal(verdict.ok, true);
assert.equal(verdict.llm_score, 78.4);
log("validateImage parses verdict");

// Error body: requestJson reads `json.error`; without it the message degrades
// to "Request failed (status)". Pinned so nobody removes the `error` key from
// the backend's exception handlers without noticing the user-visible effect.
nextResponse = { status: 400, body: { error: "status must not be blank" } };
await assert.rejects(
  () => api.updateGrievanceStatus("GRV-2026-0001", { status: "" }),
  /status must not be blank/
);
log("error bodies surface json.error to the user");

nextResponse = { status: 404, body: { detail: "Not Found" } };
await assert.rejects(
  () => api.updateGrievanceStatus("GRV-1999-9999", { status: "x" }),
  /Request failed \(404\)/
);
log("BASELINE a 'detail'-shaped error degrades to a generic message");

/* ── 4. parseCityState / formatCityState ─────────────────────────────────── */
// Pure Nominatim-address parsing for similar-complaint "City, State" labels.
// No network involved, so these run offline like the rest of this script.
const location = await import("../lib/location.ts");

// Full address: city + state win over district-level fallbacks.
assert.deepEqual(
  location.parseCityState({
    suburb: "Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
  }),
  { city: "Bengaluru", state: "Karnataka" }
);
// Town/village/district fallbacks when no `city` key exists.
assert.deepEqual(
  location.parseCityState({ town: "Dharampeth", state: "Maharashtra" }),
  { city: "Dharampeth", state: "Maharashtra" }
);
assert.deepEqual(
  location.parseCityState({ state_district: "Pune", state: "Maharashtra" }),
  { city: "Pune", state: "Maharashtra" }
);
// Missing halves degrade gracefully instead of printing "null".
assert.deepEqual(location.parseCityState({ state: "Goa" }), {
  city: null,
  state: "Goa",
});
assert.deepEqual(location.parseCityState({}), { city: null, state: null });
assert.deepEqual(location.parseCityState(null), { city: null, state: null });
assert.equal(
  location.formatCityState({ city: "Bengaluru", state: "Karnataka" }),
  "Bengaluru, Karnataka"
);
assert.equal(location.formatCityState({ city: null, state: "Goa" }), "Goa");
assert.equal(location.formatCityState({ city: "Panaji", state: null }), "Panaji");
assert.equal(location.formatCityState(null), null);
log("parseCityState/formatCityState city-state labels");

/* ── 5. Camera track stopping & face request timeout ──────────────────────── */
const camera = await import("../lib/camera.ts");

let stoppedCount = 0;
const mockTracks = [
  { stop: () => { stoppedCount++; } },
  { stop: () => { stoppedCount++; } },
  { stop: () => { throw new Error("already stopped"); } },
];
const mockStream = { getTracks: () => mockTracks };

camera.stopMediaStream(mockStream);
assert.equal(stoppedCount, 2, "all valid tracks must be stopped");
camera.stopMediaStream(null); // safe on null
log("stopMediaStream teardown", "all tracks stopped safely without unhandled throws");

assert.equal(api.FACE_REQUEST_TIMEOUT_MS, 60_000);
assert.equal(
  api.FACE_TIMEOUT_MESSAGE,
  "First run loads the face model, this can take a minute. Try again."
);
log("face request timeout constants", "60s cap with model load explanation");

console.log("\ncontract checks passed");
