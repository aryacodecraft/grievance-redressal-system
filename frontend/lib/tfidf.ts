/**
 * Client-side TF-IDF + greedy clustering.
 *
 * A faithful TypeScript port of the legacy `functions/tfidf.js`
 * (retired in Phase 4), kept
 * client-side so the admin cluster panel behaves exactly as it did before.
 * (The migration plan may later move this behind the API.)
 */

import type { Grievance } from "./types";

const AREA_PATTERNS = [
  "peth",
  "nagar",
  "colony",
  "vihar",
  "bagh",
  "gaon",
  "chowk",
  "market",
  "ward",
  "block",
  "sector",
  "layout",
  "dharampeth",
];

export interface TfidfCluster {
  clusterId: string;
  size: number;
  /** Indices into the input grievances array (matches legacy behaviour). */
  ids: number[];
  sample: string;
  area: string;
  keywords: string[];
}

type SparseVec = Map<number, number>;

function tokenize(text: string): string[] {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !/^\d+$/.test(t));
}

function capitalizeWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function detectArea(text: string | null): string | null {
  if (!text) return null;
  const words = String(text)
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ""))
    .filter(Boolean);
  for (const w of words) {
    const lw = w.toLowerCase();
    for (const p of AREA_PATTERNS) {
      if (lw === p || lw.endsWith(p)) return capitalizeWords(w);
    }
  }
  const regex = new RegExp(
    `\\b([A-Za-z]{3,}(?:\\s+[A-Za-z]{3,})?)\\s+(?:${AREA_PATTERNS.join("|")})\\b`,
    "i"
  );
  const m = String(text).match(regex);
  return m && m[0] ? capitalizeWords(m[0].trim()) : null;
}

function buildTfIdf(corpus: string[]): {
  vocab: Map<string, number>;
  vectors: SparseVec[];
} {
  const docsTokens = corpus.map(tokenize);
  const vocab = new Map<string, number>();
  let idx = 0;
  docsTokens.forEach((tokens) =>
    tokens.forEach((tok) => {
      if (!vocab.has(tok)) vocab.set(tok, idx++);
    })
  );

  const N = docsTokens.length;
  const df = new Float32Array(vocab.size);
  docsTokens.forEach((tokens) => {
    const set = new Set(tokens);
    set.forEach((tok) => {
      const i = vocab.get(tok);
      if (i !== undefined) df[i] += 1;
    });
  });

  const idf = new Float32Array(vocab.size);
  for (const i of vocab.values()) {
    idf[i] = Math.log((N + 1) / (df[i] + 1)) + 1;
  }

  const vectors: SparseVec[] = docsTokens.map((tokens) => {
    const tf = new Map<number, number>();
    tokens.forEach((tok) => {
      const i = vocab.get(tok);
      if (i !== undefined) tf.set(i, (tf.get(i) ?? 0) + 1);
    });
    const vec: SparseVec = new Map();
    let norm = 0;
    for (const [i, cnt] of tf.entries()) {
      const val = (cnt / Math.max(1, tokens.length)) * (idf[i] || 1);
      vec.set(i, val);
      norm += val * val;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [i, v] of vec.entries()) vec.set(i, v / norm);
    return vec;
  });

  return { vocab, vectors };
}

function cosine(a: SparseVec, b: SparseVec): number {
  if (!a || !b) return 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  let s = 0;
  for (const [k, v] of small.entries()) {
    const bv = big.get(k);
    if (bv) s += v * bv;
  }
  return s;
}

/** Greedy single-link-style clustering with centroid update. */
function greedy(vectors: SparseVec[], threshold = 0.38) {
  const clusters: { ids: number[]; centroid: SparseVec }[] = [];
  for (let i = 0; i < vectors.length; i++) {
    const vec = vectors[i] ?? new Map<number, number>();
    if (vec.size === 0) {
      clusters.push({ ids: [i], centroid: new Map() });
      continue;
    }
    let best = { idx: -1, sim: -1 };
    for (let c = 0; c < clusters.length; c++) {
      const sim = cosine(vec, clusters[c].centroid);
      if (sim > best.sim) best = { idx: c, sim };
    }
    if (best.idx !== -1 && best.sim >= threshold) {
      clusters[best.idx].ids.push(i);
      const centroid = new Map(clusters[best.idx].centroid);
      for (const [k, v] of vec.entries()) {
        centroid.set(k, (centroid.get(k) ?? 0) + v);
      }
      let norm = 0;
      for (const v of centroid.values()) norm += v * v;
      norm = Math.sqrt(norm) || 1;
      for (const [k, v] of centroid.entries()) centroid.set(k, v / norm);
      clusters[best.idx].centroid = centroid;
    } else {
      clusters.push({ ids: [i], centroid: new Map(vec) });
    }
  }
  return clusters;
}

function topKeywords(
  centroid: SparseVec,
  vocab: Map<string, number>,
  k = 4
): string[] {
  if (!centroid || centroid.size === 0) return [];
  const inv: string[] = [];
  for (const [tok, i] of vocab.entries()) inv[i] = tok;
  const arr: [number, number][] = [];
  centroid.forEach((v, i) => arr.push([i, v]));
  arr.sort((a, b) => b[1] - a[1]);
  return arr
    .slice(0, k)
    .map((x) => inv[x[0]])
    .filter(Boolean);
}

/** Area label: stored area/locality → rounded coords → text detection. */
function areaFor(g: Grievance, text: string): string | null {
  const rec = g as unknown as Record<string, unknown>;
  const hf = (rec.hfEngine ?? {}) as Record<string, unknown>;
  const explicit = rec.area ?? rec.locality ?? hf.area ?? hf.location;
  if (explicit) return String(explicit).trim();

  if (g.latitude != null && g.longitude != null) {
    return `${Number(g.latitude).toFixed(3)}, ${Number(g.longitude).toFixed(3)}`;
  }
  return detectArea(text);
}

/** Cluster grievances by title+description similarity. Groups of size ≥ 2 only. */
export function runTfidf(grievances: Grievance[]): TfidfCluster[] {
  if (!grievances || !grievances.length) return [];

  const corpus = grievances.map((g) =>
    `${g.title ?? ""} ${g.description ?? ""}`.trim()
  );
  const tf = buildTfIdf(corpus);
  const raw = greedy(tf.vectors, 0.38);

  const clusters = raw
    .map((c, idx) => {
      const ids = c.ids.slice();
      const sample = corpus[ids[0]] ?? "";

      const areaCounts: Record<string, number> = {};
      ids.forEach((i) => {
        const g = grievances[i];
        if (!g) return;
        const name = areaFor(g, corpus[i] ?? "");
        if (name) areaCounts[name] = (areaCounts[name] ?? 0) + 1;
      });
      const area = Object.keys(areaCounts).length
        ? Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0][0]
        : "Unknown";

      return {
        clusterId: `cluster_${idx}`,
        size: ids.length,
        ids,
        sample,
        area,
        keywords: topKeywords(c.centroid, tf.vocab, 4),
      };
    })
    .filter((c) => c.size >= 2);

  clusters.sort((a, b) => b.size - a.size);
  return clusters;
}
