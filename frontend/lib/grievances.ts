"use client";

import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb, isAdminEmail } from "./firebase";
import type { Grievance, HfEngine } from "./types";

function toGrievance(id: string, data: DocumentData): Grievance {
  const created = data.createdAt;
  const createdAt =
    created && typeof created.toDate === "function"
      ? (created.toDate() as Date).toISOString()
      : typeof created === "string"
        ? created
        : new Date().toISOString();
  const hf = (data.hfEngine ?? undefined) as HfEngine | undefined;
  return {
    id,
    title: String(data.title ?? "Untitled"),
    description: String(data.description ?? ""),
    status: String(data.status ?? "open"),
    category: String(hf?.category ?? data.category ?? "other"),
    priority: String(hf?.priority ?? data.priority ?? "low"),
    createdAt,
    imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
    latitude: typeof data.latitude === "number" ? data.latitude : undefined,
    longitude: typeof data.longitude === "number" ? data.longitude : undefined,
    hfEngine: hf,
    assignee: data.assignee ? String(data.assignee) : undefined,
  };
}

function handleSnapshot(
  snap: QuerySnapshot,
  onData: (items: Grievance[]) => void
) {
  onData(snap.docs.map((d) => toGrievance(d.id, d.data())));
}

/**
 * Live list for the admin dashboard / queue. Admins (allowlisted email) see
 * the latest 50 across all users; citizens see only their own (matches the
 * deployed userId+createdAt composite index).
 */
export function subscribeGrievances(
  uid: string,
  email: string | null,
  onData: (items: Grievance[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  const db = getFirestoreDb();
  if (!db) {
    onError("Live database is not configured.");
    return () => undefined;
  }
  const col = collection(db, "grievances");
  const q = isAdminEmail(email)
    ? query(col, orderBy("createdAt", "desc"), limit(50))
    : query(
        col,
        where("userId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(50)
      );
  return onSnapshot(q, (snap) => handleSnapshot(snap, onData), (err) =>
    onError(err.message)
  );
}

/** Live single-doc lookup for the Track page (rules: owner or admin). */
export async function fetchGrievanceById(id: string): Promise<Grievance | null> {
  const db = getFirestoreDb();
  if (!db) throw new Error("Live database is not configured.");
  const snap = await getDoc(doc(db, "grievances", id.trim()));
  if (!snap.exists()) return null;
  return toGrievance(snap.id, snap.data());
}
