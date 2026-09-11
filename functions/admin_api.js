// functions/admin.api.js
// Stable Firebase / Firestore API wrapper. Edit this only when backend behavior changes.

const firebaseConfig = {
  apiKey: "AIzaSyAWTsTs_NEav91LKQ5jLrVf3ojsLYAY4XI",
  authDomain: "grievance-redressal-syst-627d7.firebaseapp.com",
  projectId: "grievance-redressal-syst-627d7",
  storageBucket: "grievance-redressal-syst-627d7.firebasestorage.app",
  messagingSenderId: "47862331768",
  appId: "1:47862331768:web:423bb1a0ac46e259d1b08d",
  measurementId: "G-YX2Y3RFF3P"
};

// Ensure firebase libs are available (they are loaded in admin.html)
if (!window.firebase) {
  throw new Error("Firebase SDK not found. Make sure admin.html includes Firebase scripts before admin.api.js");
}

// Initialize app only once
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Admin whitelist (same as before)
export const ADMIN_EMAILS = ["aryaadmin@gmail.com"];

/**
 * Helper: return a best-effort image URL from a document's data object.
 * Checks common field names and looks for any string that looks like an http(s) url.
 */
export function getImageUrlFromDoc(data) {
  if (!data || typeof data !== 'object') return null;
  const candidates = [
    'imageUrl', 'imageURL', 'image', 'photo', 'img', 'image_url', 'image_uri', 'fileUrl', 'attachment', 'photoUrl', 'photo_url'
  ];
  for (const k of candidates) {
    if (data[k] && typeof data[k] === 'string' && (data[k].startsWith('http://') || data[k].startsWith('https://'))) {
      return data[k];
    }
  }
  // fallback: find any string field that looks like a url (cloudinary, s3, firebase storage, etc)
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string' && /^(https?:\/\/)/i.test(v) &&
        /(res\.cloudinary\.com|cloudfront\.net|s3\.amazonaws\.com|firebasestorage\.googleapis\.com|firebaseapp\.com)/i.test(v)) {
      return v;
    }
  }
  return null;
}

/**
 * Subscribe to grievances collection (ordered by createdAt desc).
 * onChange receives (itemsArray)
 * returns unsubscribe function
 *
 * NOTE: If the ordered realtime query returns empty (likely because many docs
 * are missing createdAt) or Firestore returns an index/permission error,
 * we fallback to a non-ordered listener / one-time fetch so older docs show up.
 */
export function subscribeGrievancesRealtime(onChange, onError) {
  // preferred ordered realtime query
  const orderedQuery = db.collection("grievances").orderBy("createdAt", "desc");

  let unsub = null;

  try {
    unsub = orderedQuery.onSnapshot(snapshot => {
      // if snapshot has docs -> render them
      if (snapshot && !snapshot.empty) {
        const items = [];
        snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        onChange(items);
        return;
      }

      // empty snapshot: likely because many docs lack createdAt.
      // fallback to non-ordered realtime listener (or one-time get if realtime unsupported)
      console.warn('[admin.api] ordered snapshot empty — falling back to non-ordered listener');
      // unsubscribe the ordered listener and replace
      try { if (unsub) { unsub(); } } catch (_) {}
      const fallbackQuery = db.collection("grievances"); // no orderBy
      // best-effort: realtime fallback
      const fallbackUnsub = fallbackQuery.onSnapshot(fbSnap => {
        const arr = [];
        fbSnap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        // sort client-side: prefer createdAt desc when present
        arr.sort((a, b) => {
          const at = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate().getTime() : 0;
          const bt = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate().getTime() : 0;
          return bt - at;
        });
        onChange(arr);
      }, fbErr => {
        console.error('[admin.api] fallback realtime error', fbErr);
        if (typeof onError === 'function') onError(fbErr);
      });
      // return fallback unsubscribe to caller
      unsub = fallbackUnsub;
    }, err => {
      // Handle ordered query errors (index / permission). Try a one-time fetch fallback.
      console.error('[admin.api] ordered realtime error', err);
      if (typeof onError === 'function') onError(err);

      // attempt one-time non-ordered get as fallback
      db.collection('grievances').get()
        .then(snap => {
          const arr = [];
          snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
          arr.sort((a, b) => {
            const at = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate().getTime() : 0;
            const bt = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate().getTime() : 0;
            return bt - at;
          });
          onChange(arr);
        })
        .catch(getErr => {
          console.error('[admin.api] fallback get failed', getErr);
          if (typeof onError === 'function') onError(getErr);
        });
    });
  } catch (e) {
    console.error('[admin.api] subscribeGrievancesRealtime unexpected error', e);
    if (typeof onError === 'function') onError(e);
  }

  // return unsubscribe function wrapper
  return () => {
    try { if (typeof unsub === 'function') unsub(); }
    catch (e) { console.warn('[admin.api] unsubscribe error', e); }
  };
}

/** One-time fetch of grievances (array)
 *  Attempts ordered fetch first; if empty or fails, falls back to non-ordered fetch and sorts client-side.
 */
export async function fetchGrievancesOnce() {
  try {
    const snap = await db.collection("grievances").orderBy("createdAt", "desc").get();
    // if ordered returned docs -> use them
    if (snap && !snap.empty) {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      return arr;
    }
    // ordered empty -> fallback
    console.warn('[admin.api] ordered fetch empty — falling back to un-ordered fetch');
  } catch (err) {
    // ordered fetch may fail due to index requirements or permission quirk; fallback below
    console.warn('[admin.api] ordered fetch error — falling back to un-ordered fetch', err);
  }

  // fallback: get all docs without order and sort client-side
  const snap2 = await db.collection('grievances').get();
  const arr2 = [];
  snap2.forEach(d => arr2.push({ id: d.id, ...d.data() }));
  arr2.sort((a, b) => {
    const at = (a.createdAt && typeof a.createdAt.toDate === 'function') ? a.createdAt.toDate().getTime() : 0;
    const bt = (b.createdAt && typeof b.createdAt.toDate === 'function') ? b.createdAt.toDate().getTime() : 0;
    return bt - at;
  });
  return arr2;
}

/** Mark a grievance resolved by id */
export async function markResolved(id) {
  if (!id) throw new Error("id required");
  await db.collection("grievances").doc(id).update({ status: "resolved" });
  return true;
}

/** Recategorize or update fields on a grievance (partial update) */
export async function updateGrievance(id, patch = {}) {
  if (!id) throw new Error("id required");
  await db.collection("grievances").doc(id).update(patch);
  return true;
}

/** Auth helpers */
export async function signInWithEmail(email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}
export function signOut() { return auth.signOut(); }
export function onAuthStateChanged(fn) { return auth.onAuthStateChanged(fn); }
export function getCurrentUser() { return auth.currentUser; }

// small helper exported for UI to open marker/popups if needed
export function getMarkerDataSnapshotConvert(snapshot) {
  const items = [];
  snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
  return items;
}

// Export the low-level objects in case UI needs advanced ops
export { auth as firebaseAuth, db as firestoreDB };
