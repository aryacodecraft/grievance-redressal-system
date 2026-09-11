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
  status: string;
  category: string;
  priority: string;
  createdAt: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  hfEngine?: HfEngine;
  assignee?: string;
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

// Must match CATEGORY_KEYS in backend/server.py — the server only ever
// emits these keys.
export const CATEGORIES = [
  "water",
  "roads",
  "electricity",
  "sanitation",
  "health",
  "governance",
  "other",
] as const;
