export interface HfEngine {
  category: string;
  priority: string;
  isUrgent: boolean;
  keywords: string[];
  explanation: string;
  rawCategoryLabel?: string;
  categoryConfidence?: number;
  urgentMatches?: string[];
}

export interface Grievance {
  id: string;
  title: string;
  description: string;
  userId?: string | null;
  status: string;
  category: string;
  priority: string;
  createdAt: string;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  hfEngine?: HfEngine | null;
  assignee?: string | null;
}

export interface SubmitPayload {
  title: string;
  description: string;
  userId: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
}

export interface SubmitResult {
  message: string;
  grievanceId: string;
  hfEngine: HfEngine;
}

export interface ImageValidation {
  ok: boolean;
  llm_score?: number;
  explanation?: string;
}

// Must match CATEGORY_KEYS in backend/app/services/classification.py — the
// server only ever emits these keys.
export const CATEGORIES = [
  "water",
  "roads",
  "transport",
  "electricity",
  "sanitation",
  "health",
  "governance",
  "other",
] as const;
