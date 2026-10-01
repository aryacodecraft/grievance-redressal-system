import { z } from "zod";
import type { ImageValidation, SubmitPayload, SubmitResult } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000";

async function requestJson<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
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
});

const submitResultSchema = z.object({
  message: z.string(),
  grievanceId: z.string(),
  hfEngine: hfEngineSchema,
});

const imageValidationSchema = z.object({
  ok: z.boolean(),
  llm_score: z.number().optional(),
  explanation: z.string().optional(),
});

const grievanceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  userId: z.string().nullish(),
  status: z.string().default("open"),
  category: z.string().default("other"),
  priority: z.string().default("low"),
  createdAt: z.string(),
  imageUrl: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  hfEngine: hfEngineSchema.nullish(),
  assignee: z.string().nullish(),
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
}): Promise<z.infer<typeof grievanceListSchema>> {
  const qs = params?.userId
    ? `?userId=${encodeURIComponent(params.userId)}`
    : "";
  const raw = await requestJson<unknown>(`/grievances${qs}`, { method: "GET" });
  return grievanceListSchema.parse(raw);
}

/** Fetch a single grievance; returns null on 404. */
export async function getGrievance(
  id: string
): Promise<z.infer<typeof grievanceSchema> | null> {
  const res = await fetch(
    `${API_URL}/grievances/${encodeURIComponent(id.trim())}`,
    { headers: { Accept: "application/json" }, cache: "no-store" }
  );
  if (res.status === 404) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (json && (json.error as string)) || `Request failed (${res.status})`
    );
  }
  return grievanceSchema.parse(json);
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
  return process.env.NEXT_PUBLIC_USE_MOCKS !== "false";
}

export const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
export const CLOUDINARY_UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";
