import { z } from "zod";
import type { ImageValidation, SubmitPayload, SubmitResult } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10000";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (json && (json.error as string)) || `Request failed (${res.status})`
    );
  }
  return json as T;
}

const hfEngineSchema = z.object({
  category: z.string(),
  // Server can return priority: null when no keyword rule hits and no LLM
  // is configured (backend/server.py classify_priority). Fall back to "low"
  // so a saved grievance never surfaces as a client error.
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

export async function submitGrievance(
  payload: SubmitPayload
): Promise<SubmitResult> {
  const raw = await postJson<unknown>("/submit-grievance", payload);
  return submitResultSchema.parse(raw);
}

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

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
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
