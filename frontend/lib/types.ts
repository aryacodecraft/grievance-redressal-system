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
  state?: string;
  departmentId?: string | null;
  ownerId?: string | null;
  managerId?: string | null;
  dueDate?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  stateHistory?: StateHistoryEntry[] | null;
  assignmentHistory?: StateHistoryEntry[] | null;
}

export interface StateHistoryEntry {
  from?: string;
  to?: string;
  by?: string;
  byRole?: string;
  reason?: string;
  at?: string;
  createdAt?: string;
  bodyCustomer?: string;
  bodyInternal?: string;
  visibility?: string;
  kind?: string;
  [key: string]: unknown;
}

export interface SubmitPayload {
  title: string;
  description: string;
  userId?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
}

export interface SubmitResult {
  message: string;
  grievanceId: string;
  hfEngine: HfEngine;
}

export interface AuthUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  citizen_id?: string | null;
  name: string;
  role: "USER" | "ADMIN" | "RESOLVER" | "SUPERADMIN" | "citizen" | "admin" | string;
  avatarUrl?: string;
  departmentId?: string | null;
  authMethod?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    citizen_id?: string | null;
    full_name: string;
    role: string;
    avatar_url?: string;
    departmentId?: string | null;
    auth_method?: string;
  };
}

/** POST /auth/login pauses here when a privileged account opted into the
 *  optional face step (DEC-024): a short-lived pending token instead of the
 *  full pair. The pending token only unlocks /auth/face/verify-second-factor
 *  and /auth/complete-pending — never protected routes. */
export interface FacePendingResponse {
  two_factor: "face";
  token_type: string;
  pending_token: string;
}

/** POST /auth/face/challenge — one single-use liveness prompt, 30 s TTL.
 *  The frames captured against it must perform `action`. */
export interface FaceChallenge {
  challenge_id: string;
  action: string;
  expires_in: number;
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
