
import {
  ADMIN_EMAILS,
  subscribeGrievancesRealtime,
  fetchGrievancesOnce,
  markResolved,
  signInWithEmail,
  signOut,
  onAuthStateChanged,
  getCurrentUser
} from './admin_api.js';

// DOM elements (same IDs as your admin.html)
const adminLoginSection = document.getElementById("adminLoginSection");
const dashboardSection = document.getElementById("dashboardSection");
const adminEmailSpan = document.getElementById("adminEmail");
const signOutBtn = document.getElementById("signOutBtn");
const statusEl = document.getElementById("status");
const dashboardWrap = document.getElementById("dashboardWrap");
const summaryPanel = document.getElementById("summaryPanel");
const summaryBtn = document.getElementById("summaryBtn");
const clustersList = document.getElementById("clustersList");

let grievances = [];
let unsubscribe = null;
let currentPage = 1;
let pageSize = 10;
let map = null;
let markersLayer = null;
const markersById = {};
let tfidfClusters = [];

/* helpers */
function showStatus(msg, cls) {
  if (statusEl) {
    statusEl.innerText = msg;
    statusEl.className = `mt-2 text-center fw-bold ${cls || ""}`;
    setTimeout(()=> { if (statusEl.innerText === msg) statusEl.innerText = ""; }, 3500);
  } else console.log("STATUS:", msg);
}
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* init map (same as before) */
function initMap(){
  if (map) return;
  if (typeof L === "undefined") return console.warn("Leaflet missing");
  map = L.map("map").setView([20.5937,78.9629], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
  markersLayer = L.featureGroup().addTo(map);
  setTimeout(()=>{ try{ map.invalidateSize(); }catch(e){} }, 300);
}

/* Auth wiring */
onAuthStateChanged(user => {
  if (!user) {
    if (adminLoginSection) adminLoginSection.style.display = "block";
    if (dashboardSection) dashboardSection.style.display = "none";
    if (adminEmailSpan) adminEmailSpan.innerText = "";
    if (signOutBtn) signOutBtn.style.display = "none";
    if (unsubscribe) { try { unsubscribe(); } catch(e){} unsubscribe = null; }
    return;
  }

  if (!ADMIN_EMAILS.includes(user.email)) {
    showStatus("❌ You are signed in but not an admin.", "text-danger");
    signOut();
    return;
  }

  if (adminEmailSpan) adminEmailSpan.innerText = user.email;
  if (adminLoginSection) adminLoginSection.style.display = "none";
  if (dashboardSection) dashboardSection.style.display = "block";
  if (signOutBtn) signOutBtn.style.display = "inline-block";
  showStatus("✅ Signed in as admin", "text-success");

  initMap();

  // subscribe to real-time grievances
  if (unsubscribe) { try{ unsubscribe(); } catch(e){} }
  unsubscribe = subscribeGrievancesRealtime(items => {
    grievances = items;
    currentPage = 1;
    renderStats();
    runClientClustering();
    renderGrievances();
  }, err => {
    console.error("snapshot error", err);
    showStatus("❌ Failed loading grievances", "text-danger");
  });
});

/* login/signout wrappers used by admin.html buttons */
window._admin = window._admin || {};
window._admin.login = async function login() {
  const email = (document.getElementById("adminEmailInput") || {}).value?.trim() || "";
  const password = (document.getElementById("adminPasswordInput") || {}).value?.trim() || "";
  if (!email || !password) { showStatus("⚠️ Enter email & password","text-warning"); return; }
  try {
    await signInWithEmail(email, password);
    showStatus("✅ Signed in — waiting for auth state...", "text-success");
  } catch (err) {
    console.error("login err", err);
    showStatus("❌ Login failed: " + (err?.message || String(err)), "text-danger");
  }
};
window._admin.signOut = function(){ signOut(); };

/* Stats, filters, rendering — adapted from your original functions, but UI-only */
function renderStats(){
  const total = grievances.length;
  let highOpen=0, medOpen=0, resolved=0;
  grievances.forEach(g=>{
    const status = (g.status || "open").toLowerCase();
    const p = (g.hfEngine?.priority || "low").toLowerCase();
    if(status === "resolved") resolved++; else { if(p==="high") highOpen++; if(p==="medium") medOpen++; }
  });
  document.getElementById("statTotal").innerText = total;
  document.getElementById("statHighOpen").innerText = highOpen;
  document.getElementById("statMediumOpen").innerText = medOpen;
  document.getElementById("statResolved").innerText = resolved;
}

function onFilterChange(){ currentPage = 1; renderGrievances(); }
function onPageSizeChange(){ pageSize = Number(document.getElementById("pageSizeSelect").value) || 10; currentPage = 1; renderGrievances(); }
function priorityWeight(p){ if(p==="high") return 3; if(p==="medium") return 2; return 1; }
function asEpoch(x){
  if(!x) return 0;
  if(typeof x.toDate === "function") {
    try { return x.toDate().getTime(); } catch(e) {}
  }
  if(x instanceof Date) return x.getTime();
  if(typeof x === "number") return x > 1e12 ? x : x * 1000;
  if(typeof x === "string") { const t = Date.parse(x); if(!Number.isNaN(t)) return t; }
  return 0;
}

function renderGrievances(){
  const listEl = document.getElementById("grievanceList");
  if(!listEl) return;
  if(!grievances.length){ listEl.innerHTML = `<div class="text-center text-muted py-5">No grievances yet</div>`; updateMapMarkers([]); return; }

  const priorityFilter = document.getElementById("priorityFilter").value;
  const categoryFilter = document.getElementById("categoryFilter").value;
  const statusFilter = document.getElementById("statusFilter").value;
  const searchText = (document.getElementById("searchInput").value || "").trim().toLowerCase();

  let filtered = grievances.filter(g=>{
    const hf = g.hfEngine || {};
    const pr = (hf.priority || "low").toLowerCase();
    const cat = (hf.category || "other").toLowerCase();
    const st = (g.status || "open").toLowerCase();
    if(priorityFilter !== "all" && pr !== priorityFilter) return false;
    if(categoryFilter !== "all" && cat !== categoryFilter) return false;
    if(statusFilter !== "all" && st !== statusFilter) return false;
    if(searchText){
      const blob = `${g.title || ""} ${g.description || ""}`.toLowerCase();
      if(!blob.includes(searchText)) return false;
    }
    return true;
  });

  if(window._selectedClusterIds && window._selectedClusterIds.size){
    filtered = filtered.filter(g => window._selectedClusterIds.has(g.id));
  }

  filtered.sort((a,b)=>{
    const ta = asEpoch(a.createdAt);
    const tb = asEpoch(b.createdAt);
    if(ta !== tb) return tb - ta;
    const pa = priorityWeight(a.hfEngine?.priority || "low");
    const pb = priorityWeight(b.hfEngine?.priority || "low");
    if(pa !== pb) return pb - pa;
    return String(b.id || "").localeCompare(String(a.id || ""));
  });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if(currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  document.getElementById("listMeta").innerText = `${totalItems} items • page ${currentPage} of ${totalPages}`;

  let html = "";
  pageItems.forEach(g=>{
    const hf = g.hfEngine || {};
    const priority = hf.priority || "low";
    const category = hf.category || "other";
    const urgent = !!hf.isUrgent;
    const status = g.status || "open";
    let createdDate = null;
    try { createdDate = (g.createdAt && typeof g.createdAt.toDate === 'function') ? g.createdAt.toDate() : (g.createdAt instanceof Date ? g.createdAt : (typeof g.createdAt === 'number' ? new Date(asEpoch(g.createdAt)) : (typeof g.createdAt === 'string' ? new Date(asEpoch(g.createdAt)) : null))); } catch(e) { createdDate = null; }
    const created = createdDate || new Date();
    const createdStr = created.toLocaleDateString() + " " + created.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    const badgeClass = priority==="high" ? "badge-priority-high" : (priority==="medium" ? "badge-priority-medium" : "badge-priority-low");

    html += `
      <div class="grievance-row" onclick="onRowClick('${g.id}')">
        <div class="d-flex justify-content-between align-items-start">
          <div style="max-width:72%;">
            <div class="d-flex align-items-center mb-1">
              <strong>${escapeHtml(g.title || "Untitled")}</strong>
              <span class="badge ms-2 ${badgeClass}">${escapeHtml(priority)}</span>
              ${urgent ? `<span class="badge ms-2 badge-urgent">URGENT</span>` : ""}
              <span class="badge ms-2 bg-secondary">${escapeHtml(category)}</span>
            </div>
            <div class="mb-1 small text-muted">
              ${escapeHtml((g.description || "").slice(0,140))}
              ${(g.description || "").length > 140 ? "..." : ""}
            </div>
            <div class="small text-muted">
              <span class="me-3"><span class="small-label">Created:</span> ${escapeHtml(createdStr)}</span>
              <span class="me-3"><span class="small-label">User:</span> ${escapeHtml(g.userId || "-")}</span>
            </div>
          </div>

          <div class="text-end">
            <button class="btn btn-sm btn-outline-light mb-2" onclick="event.stopPropagation(); onRowClick('${g.id}')">Open</button>
            ${status === "open"
              ? `<button id="resolve-btn-${g.id}" class="btn btn-sm btn-outline-success" onclick="event.stopPropagation(); markResolvedHandler('${g.id}', this)">Resolve</button>`
              : `<button class="btn btn-sm btn-secondary" disabled>Resolved</button>`
            }
          </div>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
  renderPaginationControls(totalItems);
  updateMapMarkers(filtered);
}

/* pagination UI */
function renderPaginationControls(totalItems){
  const el = document.getElementById("paginationButtons");
  if(!el) return;
  el.innerHTML = "";
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const prev = document.createElement("button"); prev.className = "btn btn-sm btn-outline-light page-btn"; prev.innerText = "Prev"; prev.disabled = currentPage <= 1;
  prev.onclick = ()=>{ if(currentPage>1){ currentPage--; renderGrievances(); } }; el.appendChild(prev);

  const maxButtons = Math.min(7, totalPages);
  let start = Math.max(1, currentPage - 3);
  let end = Math.min(totalPages, start + maxButtons - 1);
  for(let i=start;i<=end;i++){
    const b = document.createElement("button");
    b.className = `btn btn-sm ${i===currentPage ? "btn-primary" : "btn-outline-light"} page-btn`;
    b.innerText = i;
    b.onclick = ()=>{ currentPage = i; renderGrievances(); };
    el.appendChild(b);
  }

  const next = document.createElement("button"); next.className = "btn btn-sm btn-outline-light page-btn"; next.innerText = "Next"; next.disabled = currentPage >= totalPages;
  next.onclick = ()=>{ if(currentPage<totalPages){ currentPage++; renderGrievances(); } }; el.appendChild(next);

  setTimeout(()=>{ try{ map?.invalidateSize(); }catch(e){} }, 150);
}

/* mark resolved (calls admin.api) */
async function markResolvedHandler(id, btnEl) {
  try {
    if (btnEl) { btnEl.disabled = true; btnEl.innerText = "Resolving..."; }
    await markResolved(id);
    const idx = grievances.findIndex(x => x.id === id);
    if (idx !== -1) grievances[idx].status = "resolved";
    renderStats();
    renderGrievances();
    runClientClustering();
    showStatus("✅ Marked resolved", "text-success");
  } catch (e) {
    console.error("markResolved error", e);
    if (btnEl) { btnEl.disabled = false; btnEl.innerText = "Resolve"; }
    showStatus("❌ Failed to update status", "text-danger");
  }
}

/* map markers (same as before) */
function updateMapMarkers(list){
  if(!map || !markersLayer) return;
  markersLayer.clearLayers();
  for(const k in markersById) delete markersById[k];
  const pts = [];
  list.forEach(g=>{
    const lat = Number(g.latitude ?? g.lat ?? g.location?.lat);
    const lon = Number(g.longitude ?? g.lon ?? g.location?.lon);
    if(Number.isNaN(lat) || Number.isNaN(lon)) return;
    const marker = L.marker([lat, lon]).addTo(markersLayer);
    markersById[g.id] = marker;
    const popupHtml = `<strong>${escapeHtml(g.title || "Untitled")}</strong><br/>${g.imageUrl ? `<img src="${escapeHtml(g.imageUrl)}" style="max-width:180px;max-height:120px;display:block;margin-top:6px;border-radius:6px;">` : ''}<br/>${escapeHtml(g.userId || "-")}`;
    marker.bindPopup(popupHtml);
    pts.push([lat, lon]);
  });
  if(pts.length) try{ map.fitBounds(pts, { padding: [40,40] }); }catch(e){}
}
function focusOnMarker(id){ const m = markersById[id]; if(m){ try{ map.setView(m.getLatLng(),15); m.openPopup(); }catch(e){} } else showStatus("ℹ️ No location for this grievance","text-info"); }

/* detail modal (unchanged logic) */
function onRowClick(id){
  const g = grievances.find(x => x.id === id);
  if(!g) return;
  showDetailModal(g);
  if(g.latitude != null && g.longitude != null) focusOnMarker(id);
}
function showDetailModal(g) {
  const m = document.getElementById("grievance-detail-modal");
  if (!m) return;
  const titleEl = document.getElementById("gd-title");
  const descEl = document.getElementById("gd-desc");
  const badgesEl = document.getElementById("gd-badges");
  const metaEl = document.getElementById("gd-meta");
  const latlonEl = document.getElementById("gd-latlon");
  const gdImage = document.getElementById("gd-image");

  if (titleEl) titleEl.innerText = g.title || "Untitled";
  if (descEl) descEl.innerText = g.description || "";

  const hf = g.hfEngine || {};
  const priority = (hf.priority || "low").toUpperCase();
  const cat = (hf.category || "other").toUpperCase();
  const priorityColor = priority === "HIGH" ? "#ff5252" : (priority === "MEDIUM" ? "#ffb300" : "#66bb6a");

  if (badgesEl) badgesEl.innerHTML = `
    <span style="background:${priorityColor};padding:6px 10px;border-radius:999px;color:white;font-weight:600">${escapeHtml(priority)}</span>
    ${hf.isUrgent ? `<span style="background:#ff1744;padding:6px 10px;border-radius:999px;color:white;margin-left:8px">URGENT</span>` : ""}
    <span style="background:#6c757d;padding:6px 10px;border-radius:999px;color:white;margin-left:8px">${escapeHtml(cat)}</span>
  `;

  const createdDate = g.createdAt?.toDate?.() || (g.createdAt instanceof Date ? g.createdAt : new Date(asEpoch(g.createdAt) || Date.now()));
  if (metaEl) metaEl.innerHTML = `
    <div><strong>Created:</strong> ${createdDate.toLocaleString()}</div>
    <div><strong>User:</strong> ${escapeHtml(g.userId || "-")}</div>
    <div><strong>Keywords:</strong> ${(hf.keywords || []).slice(0,6).map(escapeHtml).join(", ")}</div>
  `;

  if (latlonEl) latlonEl.innerHTML = (g.latitude != null && g.longitude != null)
    ? `<strong>Lat/Lon:</strong> ${Number(g.latitude).toFixed(6)}, ${Number(g.longitude).toFixed(6)}`
    : `<strong>Lat/Lon:</strong> Not provided`;

  // image injection
  if (g.imageUrl) {
    gdImage.style.display = "block";
    const img = document.createElement("img");
    img.alt = "grievance image";
    img.loading = "lazy";
    img.style.maxWidth = "100%";
    img.style.maxHeight = "480px";
    img.style.objectFit = "contain";
    img.style.borderRadius = "8px";
    img.style.border = "1px solid rgba(0,0,0,0.06)";
    img.crossOrigin = "anonymous";
    img.src = g.imageUrl;

    gdImage.innerHTML = "";
    gdImage.appendChild(img);

    const link = document.createElement("div");
    link.style.marginTop = "8px";
    link.innerHTML = `<a href="${escapeHtml(g.imageUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-light">Open original</a>`;
    gdImage.appendChild(link);

    img.onerror = () => {
      gdImage.innerHTML = `<div style="color:#f88">Failed to load image preview. <a href="${escapeHtml(g.imageUrl)}" target="_blank" rel="noopener noreferrer">Open original</a></div>`;
    };
  } else {
    gdImage.style.display = "none";
    gdImage.innerHTML = "";
  }

  const mapBtn = document.getElementById("gd-map-btn");
  if (mapBtn) mapBtn.onclick = (e) => { e.stopPropagation(); focusOnMarker(g.id); };

  const resolveBtn = document.getElementById("gd-resolve-btn");
  if (resolveBtn) {
    resolveBtn.onclick = async (e) => {
      e.stopPropagation();
      await markResolvedHandler(g.id);
      hideDetailModal();
    };
  }

  m.style.display = "block";
  requestAnimationFrame(() => m.classList.add("center"));

  if (!m._outsideClickHandler) {
    m._outsideClickHandler = function outsideClickHandler(evt) {
      if (!m.contains(evt.target)) hideDetailModal();
    };
    document.addEventListener("click", m._outsideClickHandler);
  }
  if (!m._escHandler) {
    m._escHandler = function escHandler(e) { if (e.key === "Escape") hideDetailModal(); };
    document.addEventListener("keydown", m._escHandler);
  }

  const closeBtn = document.getElementById("gd-close");
  if (closeBtn) {
    try { closeBtn.replaceWith(closeBtn.cloneNode(true)); } catch(e) {}
    const freshClose = document.getElementById("gd-close");
    if (freshClose) {
      freshClose.addEventListener("click", function(ev){
        ev.preventDefault(); ev.stopPropagation(); hideDetailModal();
      });
    }
  }
}
function hideDetailModal(){
  const m = document.getElementById("grievance-detail-modal");
  if(!m) return;
  m.classList.remove("center");
  if(m._outsideClickHandler) { try{ document.removeEventListener("click", m._outsideClickHandler); }catch(e){} m._outsideClickHandler = null; }
  if(m._escHandler) { try{ document.removeEventListener("keydown", m._escHandler); }catch(e){} m._escHandler = null; }
  setTimeout(()=>{ m.style.display = "none"; }, 260);
}

/* TF-IDF cluster UI (uses global TFIDF.run from tfidf.js) */
function runClientClustering(){ try{ const clusters = (typeof TFIDF !== "undefined" && TFIDF.run) ? TFIDF.run(grievances || []) : []; tfidfClusters = clusters; renderTfidfClustersUI(); }catch(e){ console.warn(e); } }
function renderTfidfClustersUI(){
  if(!clustersList) return;
  clustersList.innerHTML = `<div style="font-weight:700;margin-bottom:8px;">TF-IDF clusters</div>`;
  const tfDiv = document.createElement("div");
  tfDiv.id = "tfidfClusters";
  tfDiv.style.marginTop = "8px";
  clustersList.appendChild(tfDiv);
  if(!tfidfClusters || !tfidfClusters.length){ tfDiv.innerHTML = "<div class='text-muted'>No TF-IDF clusters</div>"; return; }
  tfDiv.innerHTML = "";
  tfidfClusters.forEach(c=>{
    const title = c.area || "Unknown";
    const keywords = Array.isArray(c.keywords) ? c.keywords.slice(0,6).join(", ") : "";
    const sample = (c.sample || "").slice(0,120);
    const size = c.size || (Array.isArray(c.ids) ? c.ids.length : 1);
    const block = document.createElement("div");
    block.className = "summary-cluster";
    block.style.display = "flex";
    block.style.justifyContent = "space-between";
    block.style.alignItems = "center";
    block.style.padding = "10px";
    block.style.marginBottom = "8px";
    block.innerHTML = `<div style="flex:1;min-width:0;"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(title)}</div><div class="small text-muted" style="margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(keywords)}</div><div class="small text-muted mt-1" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(sample)}</div></div><div style="flex:0 0 auto;margin-left:8px;text-align:right"><div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><div class="badge bg-light text-dark" style="font-size:0.9rem;padding:6px 8px;border-radius:10px">${size}</div><button class="btn btn-sm btn-outline-light btn-tview" data-id="${escapeHtml(c.clusterId || "")}" style="padding:6px 10px">View</button></div></div>`;
    tfDiv.appendChild(block);
  });
  document.querySelectorAll(".btn-tview").forEach(b=>b.addEventListener("click", e=>{ const id = e.currentTarget.dataset.id; applyClusterFilter(id); }));
}
function applyClusterFilter(clusterId){
  if(!clusterId) { window._selectedClusterIds = null; renderGrievances(); return; }
  const c = tfidfClusters.find(x => String(x.clusterId) === String(clusterId));
  if(!c) return;
  const ids = new Set((c.ids || []).slice(0).map(i => { const maybeId = typeof i === "string" ? i : (grievances[i]?.id || null); return maybeId; }).filter(Boolean));
  window._selectedClusterIds = ids;
  renderGrievances();
}

/* Summary toggle wiring */
if(summaryBtn) summaryBtn.onclick = ()=>{ if(!summaryPanel || !dashboardWrap) return; summaryPanel.classList.toggle("open"); dashboardWrap.classList.toggle("shifted"); runClientClustering(); };

/* initial run if data present */
setTimeout(()=>{ if(grievances && grievances.length) runClientClustering(); }, 350);

/* Expose a couple of functions for inline onclick handlers in HTML */
window.onRowClick = onRowClick;
window.markResolved = markResolvedHandler;
window.onFilterChange = onFilterChange;
window.onPageSizeChange = onPageSizeChange;
window.applyClusterFilter = applyClusterFilter;
