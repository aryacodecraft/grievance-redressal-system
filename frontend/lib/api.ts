import { z } from "zod";
import type {
  AuthResponse,
  FaceChallenge,
  FacePendingResponse,
  ImageValidation,
  SubmitPayload,
  SubmitResult,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000";

const ACCESS_TOKEN_KEY = "grievai-access-token";
const REFRESH_TOKEN_KEY = "grievai-refresh-token";
// A pending_2fa token is NOT an access token: it never unlocks protected
// routes, so it lives under its own key and is never attached to requests.
const PENDING_TOKEN_KEY = "grievai-pending-token";

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredTokens(accessToken: string, refreshToken?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearStoredTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getStoredPendingToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PENDING_TOKEN_KEY);
}

export function setStoredPendingToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_TOKEN_KEY, token);
}

export function clearStoredPendingToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_TOKEN_KEY);
}

/** Narrow an /auth/login response to the face two-factor pause (DEC-024). */
export function isFacePending(
  res: AuthResponse | FacePendingResponse
): res is FacePendingResponse {
  return (res as FacePendingResponse).two_factor === "face";
}

/** Thrown by session.login() when the backend pauses for the face step, so
 *  callers can switch the form into the 2FA screen instead of failing. */
export class FaceTwoFactorRequiredError extends Error {
  readonly pendingToken: string;
  constructor(pendingToken: string) {
    super("face two-factor required");
    this.name = "FaceTwoFactorRequiredError";
    this.pendingToken = pendingToken;
  }
}

let _isRefreshing = false;

async function requestJson<T>(
  path: string,
  init: RequestInit,
  retryOn401 = true
): Promise<T> {
  const token = getStoredAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.headers as Record<string, string>),
  };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (res.status === 401 && retryOn401 && !_isRefreshing) {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      _isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
          cache: "no-store",
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setStoredTokens(data.access_token);
          _isRefreshing = false;
          return requestJson<T>(path, init, false);
        } else {
          clearStoredTokens();
        }
      } catch {
        clearStoredTokens();
      } finally {
        _isRefreshing = false;
      }
    }
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(
      (json && (json.error as string)) || `Request failed (${res.status})`
    );
    const faceReason = res.headers?.get ? res.headers.get("x-face-reason") : null;
    if (faceReason) {
      (err as unknown as { faceReason?: string }).faceReason = faceReason;
    }
    throw err;
  }
  return json as T;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, { method: "POST", body: JSON.stringify(body) });
}

function patchJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

const hfEngineSchema = z.object({
  category: z.string(),
  // Server can return priority: null when no keyword rule hits and no LLM
  // is configured (backend classifier). Fall back to "low" so a saved
  // grievance never surfaces as a client error.
  priority: z
    .string()
    .nullish()
    .transform((v) => v ?? "low"),
  isUrgent: z.boolean().default(false),
  keywords: z.array(z.string()).default([]),
  explanation: z.string().default(""),
  // Declared because `lib/types.ts` HfEngine exposes them and GrievanceCard
  // renders `categoryConfidence`. z.object() strips undeclared keys, so an
  // omission does not fail the parse — the UI just quietly stops showing the
  // value on live data while mock data (which bypasses zod) still works.
  rawCategoryLabel: z.string().optional(),
  categoryConfidence: z.number().optional(),
  urgentMatches: z.array(z.string()).optional(),
  modelInfo: z
    .object({
      categoryModel: z.string().optional(),
      priorityModel: z.string().optional(),
      sentimentLabel: z.string().optional(),
      sentimentScore: z.number().optional(),
      // Backend emits the string "None" when Groq did not run — normalise to
      // a real null so consumers can test truthiness.
      groqModel: z
        .string()
        .nullish()
        .transform((v) => (v && v !== "None" ? v : null))
        .optional(),
      hfCategory: z.string().optional(),
      hfPriority: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

const submitResultSchema = z.object({
  message: z.string(),
  grievanceId: z.string(),
  hfEngine: hfEngineSchema,
});

const imageValidationSchema = z.object({
  ok: z.boolean().default(true),
  llm_score: z.number().optional(),
  explanation: z.string().optional(),
}).passthrough();

const grievanceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  userId: z.string().nullish(),
  status: z.string().default("open"),
  state: z.string().optional(),
  category: z.string().default("other"),
  priority: z.string().default("low"),
  createdAt: z.string(),
  imageUrl: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  hfEngine: hfEngineSchema.nullish(),
  assignee: z.string().nullish(),
  departmentId: z.string().nullish(),
  ownerId: z.string().nullish(),
  managerId: z.string().nullish(),
  dueDate: z.string().nullish(),
  resolvedAt: z.string().nullish(),
  closedAt: z.string().nullish(),
  stateHistory: z.array(z.record(z.string(), z.unknown())).nullish(),
  assignmentHistory: z.array(z.record(z.string(), z.unknown())).nullish(),
  // `to_api()` emits this whenever an image was attached, and lib/types.ts
  // declares it on Grievance detail views need it back — without it here the
  // stored verdict is stripped by zod before any component can read it.
  imageValidation: imageValidationSchema.nullish(),
});

const grievanceListSchema = z.array(grievanceSchema);

/* ── Grievances ──────────────────────────────────────────────────────────── */

export async function submitGrievance(
  payload: SubmitPayload
): Promise<SubmitResult> {
  const raw = await postJson<unknown>("/submit-grievance", payload);
  return submitResultSchema.parse(raw);
}

/** List grievances. Pass `userId` to scope to a citizen's own submissions. */
export async function listGrievances(params?: {
  userId?: string;
  state?: string;
  dept?: string;
  overdue?: boolean;
}): Promise<z.infer<typeof grievanceListSchema>> {
  const query = new URLSearchParams();
  if (params?.userId) query.set("userId", params.userId);
  if (params?.state) query.set("state", params.state);
  if (params?.dept) query.set("dept", params.dept);
  if (params?.overdue) query.set("overdue", "true");
  const qs = query.toString() ? `?${query.toString()}` : "";
  const raw = await requestJson<unknown>(`/grievances${qs}`, { method: "GET" });
  return grievanceListSchema.parse(raw);
}

/** List tasks for the authenticated employee; backend scopes strictly by owner ID. */
export async function listAssignedResolverTasks(): Promise<z.infer<typeof grievanceListSchema>> {
  const raw = await requestJson<unknown>("/resolver/tasks", { method: "GET" });
  return grievanceListSchema.parse(raw);
}

export async function getDepartmentCounts(): Promise<{ total: number; counts: Record<string, number> }> {
  return requestJson<{ total: number; counts: Record<string, number> }>("/grievances/department-counts", { method: "GET" });
}

/** Fetch a single grievance; returns null on 404. Sends Bearer so private docs stay private. */
export async function getGrievance(
  id: string
): Promise<z.infer<typeof grievanceSchema> | null> {
  try {
    const raw = await requestJson<unknown>(
      `/grievances/${encodeURIComponent(id.trim())}`,
      { method: "GET" }
    );
    return grievanceSchema.parse(raw);
  } catch (err) {
    if (err instanceof Error && (/\(404\)/.test(err.message) || /Grievance not found/.test(err.message))) return null;
    throw err;
  }
}

/** Officer action: update status and/or assignee. */
export async function updateGrievanceStatus(
  id: string,
  patch: { status?: string; assignee?: string }
): Promise<z.infer<typeof grievanceSchema>> {
  const raw = await patchJson<unknown>(
    `/grievances/${encodeURIComponent(id.trim())}/status`,
    patch
  );
  return grievanceSchema.parse(raw);
}

/* ── RBAC workflow (Phase 0-3) ─────────────────────────────────────────── */

export async function assignGrievance(
  id: string,
  body: { departmentId: string; ownerId?: string; dueDate?: string; reason: string }
): Promise<unknown> {
  return postJson(`/grievances/${encodeURIComponent(id.trim())}/assign`, body);
}

export async function transitionGrievanceState(
  id: string,
  body: { to_state: string; reason: string }
): Promise<unknown> {
  return patchJson(`/grievances/${encodeURIComponent(id.trim())}/state`, body);
}

export async function addProgressUpdate(
  id: string,
  body: { bodyInternal: string; bodyCustomer?: string; visibility?: string; kind?: string; etaClass?: string; workCompleted?: string; currentSituation?: string; nextAction?: string; attachmentUrl?: string }
): Promise<unknown> {
  return postJson(`/grievances/${encodeURIComponent(id.trim())}/progress`, body);
}

export async function acceptAssignment(id: string): Promise<unknown> {
  return postJson(`/grievances/${encodeURIComponent(id.trim())}/accept`, {});
}

export async function escalateGrievance(id: string, body: { reason: string; issueType: string; description: string; suggestedAction?: string; evidenceUrl?: string }): Promise<unknown> {
  return postJson(`/grievances/${encodeURIComponent(id.trim())}/escalate`, body);
}

export async function reassignGrievance(id: string, body: { ownerId: string; departmentId?: string; reason: string }): Promise<unknown> {
  return postJson(`/grievances/${encodeURIComponent(id.trim())}/reassign`, body);
}

export async function updatePriority(id: string, priority: string, reason: string): Promise<unknown> {
  return patchJson(`/grievances/${encodeURIComponent(id.trim())}/priority`, { priority, reason });
}

export async function submitResolution(id: string, text: string, actions: string[] = [], completionPhotoUrl?: string): Promise<unknown> {
  return postJson(`/grievances/${encodeURIComponent(id.trim())}/resolution`, { text, actions, completionPhotoUrl });
}

export async function approveResolution(id: string, reason: string): Promise<unknown> {
  return postJson(`/grievances/${encodeURIComponent(id.trim())}/approve-resolution`, { reason });
}

export async function closeGrievance(id: string, reason: string): Promise<unknown> {
  return postJson(`/grievances/${encodeURIComponent(id.trim())}/close`, { reason });
}

export async function getGrievanceHistory(id: string): Promise<unknown[]> {
  const raw = await requestJson<unknown>(
    `/grievances/${encodeURIComponent(id.trim())}/history`,
    { method: "GET" }
  );
  return raw as unknown[];
}

export async function listUsers(): Promise<unknown[]> {
  const raw = await requestJson<unknown>(`/users`, { method: "GET" });
  return raw as unknown[];
}

export async function createEmployee(body: { full_name: string; email: string; password: string; departmentId?: string }): Promise<unknown> {
  return postJson("/users/employees", body);
}

export async function deleteEmployee(userId: string): Promise<unknown> {
  return requestJson(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export async function updateUserRole(userId: string, role: string, reason: string): Promise<unknown> {
  return postJson(`/users/${encodeURIComponent(userId)}/roles`, { role, reason });
}

export async function setUserActive(userId: string, isActive: boolean, reason: string): Promise<unknown> {
  return postJson(`/users/${encodeURIComponent(userId)}/active`, { is_active: isActive, reason });
}

export async function createDepartment(body: { name: string; key: string; managerId?: string; reason?: string }): Promise<unknown> {
  return postJson("/departments", body);
}

export async function updateDepartment(id: string, body: { name?: string; managerId?: string; isActive?: boolean; reason?: string }): Promise<unknown> {
  return patchJson(`/departments/${encodeURIComponent(id)}`, body);
}

export async function listDepartments(): Promise<unknown[]> {
  const raw = await requestJson<unknown>(`/departments`, { method: "GET" });
  return raw as unknown[];
}

export async function listAudit(entity?: string): Promise<unknown[]> {
  const qs = entity ? `?entity=${encodeURIComponent(entity)}` : "";
  const raw = await requestJson<unknown>(`/audit${qs}`, { method: "GET" });
  return raw as unknown[];
}

export async function listNotifications(): Promise<unknown[]> {
  const raw = await requestJson<unknown>(`/notifications`, { method: "GET" });
  return raw as unknown[];
}

export async function markNotificationRead(id: string): Promise<void> {
  await patchJson(`/notifications/${encodeURIComponent(id)}/read`, {});
}

export async function markAllNotificationsRead(): Promise<void> {
  await patchJson("/notifications/read-all", {});
}

/* ── Images ──────────────────────────────────────────────────────────────── */

export async function validateImage(
  imageUrl: string
): Promise<ImageValidation> {
  const raw = await postJson<unknown>("/validate-image", { imageUrl });
  return imageValidationSchema.parse(raw);
}

export async function deleteCloudinaryAsset(
  publicId: string
): Promise<void> {
  await postJson<unknown>("/delete-cloudinary", {
    public_id: publicId,
    resource_type: "image",
  });
}

/* ── Health / config ─────────────────────────────────────────────────────── */

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, {
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useMocks(): boolean {
  const value = (process.env.NEXT_PUBLIC_USE_MOCKS ?? "true").trim().toLowerCase();
  return !["false", "0", "no", "off"].includes(value);
}

export const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
export const CLOUDINARY_UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

/* ── Authentication ──────────────────────────────────────────────────────── */

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse | FacePendingResponse> {
  const data = await postJson<AuthResponse | FacePendingResponse>(
    "/auth/login",
    { email, password }
  );
  if (isFacePending(data)) {
    // Privileged account paused for the optional face step: stash the pending
    // token (own key, never auto-attached) and let the caller open the 2FA UI.
    setStoredPendingToken(data.pending_token);
    return data;
  }
  setStoredTokens(data.access_token, data.refresh_token);
  return data;
}

export async function registerUser(
  email: string,
  password: string,
  fullName: string
): Promise<AuthResponse> {
  const data = await postJson<AuthResponse>("/auth/register", {
    email,
    password,
    full_name: fullName,
  });
  setStoredTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getCurrentUser(): Promise<AuthResponse["user"]> {
  return requestJson<AuthResponse["user"]>("/auth/me", { method: "GET" });
}

export function getGoogleAuthUrl(): string {
  return `${API_URL}/auth/google`;
}

/* ── Face authentication (feature flag: FACE_AUTH_ENABLED, DEC-024) ───────── */

export const FACE_REQUEST_TIMEOUT_MS = 60_000;
export const FACE_TIMEOUT_MESSAGE =
  "First run loads the face model, this can take a minute. Try again.";

/**
 * POST with an explicit Authorization header and NO auto-refresh on 401.
 * Face endpoints answer with the generic "Face sign-in failed" on 401 — a
 * silent refresh-and-retry would mask it behind the stale-token path.
 * Includes a 60 s timeout to handle cold model loads gracefully.
 */
function faceJson<T>(
  path: string,
  body: unknown,
  bearer?: string,
  timeoutMs = FACE_REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return requestJson<T>(
    path,
    {
      method: "POST",
      body: JSON.stringify(body),
      signal: controller.signal,
      ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
    },
    false
  )
    .catch((err) => {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(FACE_TIMEOUT_MESSAGE);
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

/** Public config gate — every face UI element renders only when this is true. */
export async function getPublicConfig(): Promise<{
  faceAuthEnabled: boolean;
}> {
  try {
    const res = await fetch(`${API_URL}/config`, { cache: "no-store" });
    if (!res.ok) return { faceAuthEnabled: false };
    const json = (await res.json()) as { faceAuthEnabled?: boolean };
    return { faceAuthEnabled: Boolean(json.faceAuthEnabled) };
  } catch {
    return { faceAuthEnabled: false };
  }
}

/** Single-use liveness challenge; capture frames within `expires_in` (30 s). */
export function issueFaceChallenge(): Promise<FaceChallenge> {
  return faceJson<FaceChallenge>("/auth/face/challenge", {});
}

/** Start face-only citizen signup: returns short-lived signup token and challenge. */
export function startFaceSignup(body: {
  full_name: string;
  phone: string;
  consent: boolean;
}): Promise<{
  signup_token: string;
  challenge_id: string;
  action: "turn_left" | "turn_right" | "blink" | "smile";
  expires_in: number;
}> {
  return faceJson<{
    signup_token: string;
    challenge_id: string;
    action: "turn_left" | "turn_right" | "blink" | "smile";
    expires_in: number;
  }>("/auth/face/signup/start", body);
}

/** Complete face-only citizen signup: creates account and returns AuthResponse with citizen_id. */
export function completeFaceSignup(body: {
  signup_token: string;
  challenge_id: string;
  frames: string[];
}): Promise<AuthResponse & { citizen_id: string }> {
  return faceJson<AuthResponse & { citizen_id: string }>(
    "/auth/face/signup/complete",
    body
  );
}

/**
 * Store the caller's face template. `require_login_2fa` only takes effect for
 * ADMIN/SUPERADMIN (the backend enforces that).
 */
export function enrollFace(body: {
  challenge_id: string;
  frames: string[];
  consent: boolean;
  require_login_2fa: boolean;
}): Promise<{ enrolled: boolean }> {
  return faceJson<{ enrolled: boolean }>("/auth/face/enroll", body);
}

/** 1:1 face sign-in for citizens (phone or Citizen ID, or email for backwards compatibility). */
export function faceLogin(
  identifier: string,
  body: { challenge_id: string; frames: string[] }
): Promise<AuthResponse> {
  const trimmed = identifier.trim();
  const payload: Record<string, unknown> = {
    ...body,
    identifier: trimmed,
  };
  if (trimmed.includes("@")) {
    payload.email = trimmed.toLowerCase();
  }
  return faceJson<AuthResponse>("/auth/face/login", payload);
}

/** Privileged step-up; `pendingToken` is the pending_2fa token from login. */
export function verifyFaceSecondFactor(
  body: { challenge_id: string; frames: string[] },
  pendingToken: string
): Promise<AuthResponse> {
  return faceJson<AuthResponse>(
    "/auth/face/verify-second-factor",
    body,
    pendingToken
  );
}

/**
 * Lockout escape hatch: completes the pending token into a full token ONLY
 * when the account is locked out of the face endpoint; otherwise the backend
 * answers 403 "Face verification required".
 */
export function completeFacePending(
  pendingToken: string
): Promise<AuthResponse> {
  return faceJson<AuthResponse>("/auth/complete-pending", {}, pendingToken);
}

/** Does the caller already have a stored face template? */
export async function getFaceStatus(): Promise<{ enrolled: boolean }> {
  return requestJson<{ enrolled: boolean }>("/auth/face/status", {
    method: "GET",
  });
}

/** Toggle the optional post-password face step (ADMIN/SUPERADMIN only). */
export function setFaceRequireLogin2fa(
  requireLogin2fa: boolean
): Promise<{ requireLogin2fa: boolean }> {
  return patchJson<{ requireLogin2fa: boolean }>("/auth/face/template", {
    require_login_2fa: requireLogin2fa,
  });
}

/** Self-service opt-out: delete the caller's own template. */
export function deleteOwnFaceTemplate(): Promise<{ deleted: boolean }> {
  return requestJson<{ deleted: boolean }>("/auth/face/template", {
    method: "DELETE",
  });
}

/** SUPERADMIN: revoke another user's template. */
export function revokeUserFaceTemplate(
  userId: string
): Promise<{ deleted: boolean }> {
  return requestJson<{ deleted: boolean }>(
    `/auth/face/template/${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
}

/** Staff action: reset face login credential for a face_only citizen, returning a 24h token. */
export function adminResetFace(
  userId: string
): Promise<{ re_enroll_token: string; expires_in: number }> {
  return postJson<{ re_enroll_token: string; expires_in: number }>(
    `/auth/face/admin-reset/${encodeURIComponent(userId)}`,
    {}
  );
}

/** Public recovery: re-enroll face template using a staff-issued one-time token. */
export function reEnrollFace(body: {
  token: string;
  identifier: string;
  challenge_id: string;
  frames: string[];
}): Promise<AuthResponse & { re_enrolled: boolean }> {
  return faceJson<AuthResponse & { re_enrolled: boolean }>(
    "/auth/face/re-enroll",
    body
  );
}
