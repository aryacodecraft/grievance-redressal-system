import { z } from "zod";
import type { AuthResponse, ImageValidation, SubmitPayload, SubmitResult } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000";

const ACCESS_TOKEN_KEY = "grievai-access-token";
const REFRESH_TOKEN_KEY = "grievai-refresh-token";

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
    throw new Error(
      (json && (json.error as string)) || `Request failed (${res.status})`
    );
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
): Promise<AuthResponse> {
  const data = await postJson<AuthResponse>("/auth/login", { email, password });
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
