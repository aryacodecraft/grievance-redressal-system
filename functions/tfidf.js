/* tfidf.js — improved client side TF-IDF + greedy clustering (no singletons) */

// tokenize: keep alphanum tokens >=3 chars, remove pure numbers
function tf_tokenize(text){
  if(!text) return [];
  return String(text).toLowerCase()
    .replace(/[’‘“”]/g,"'")
    .replace(/[^a-z0-9\s\-]/g,' ')
    .split(/\s+/)
    .filter(t=>t.length>2 && !/^\d+$/.test(t));
}


function tf_detectArea(text){
  if(!text) return null;
  const pats = ['peth','nagar','colony','vihar','bagh','gaon','gaon','chowk','market','ward','block','sector','layout','dharampeth'];
  // try to find tokens that *end* with these suffixes or are directly like "Dharampeth"
  const words = text.split(/\s+/).map(w=>w.replace(/[^a-zA-Z]/g,'')).filter(Boolean);
  for(const w of words){
    const lw = w.toLowerCase();
    for(const p of pats){
      if(lw === p) return capitalizeWords(w);
      if(lw.endsWith(p)) return capitalizeWords(w);
      // handle two-word patterns e.g., "Govind Nagar"
    }
  }
  // try multi-word pattern: "<Name> <pat>"
  const regex = new RegExp('\\b([A-Za-z]{3,}(?:\\s+[A-Za-z]{3,})?)\\s+(?:' + pats.join('|') + ')\\b','i');
  const m = String(text).match(regex);
  if(m && m[0]) return capitalizeWords(m[0].trim());
  return null;
}

// helper to normalize capitalization for areas
function capitalizeWords(s){
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// build TF-IDF structure
function tf_buildTfIdf(corpus){
  const docsTokens = corpus.map(t=>tf_tokenize(t));
  const vocab = new Map(); let idx=0;
  docsTokens.forEach(tokens=>{ tokens.forEach(tok=>{ if(!vocab.has(tok)) vocab.set(tok, idx++); }); });
  const N = docsTokens.length;
  const df = new Float32Array(vocab.size);
  docsTokens.forEach(tokens=>{ const set = new Set(tokens); set.forEach(tok=>{ const i=vocab.get(tok); if(i!==undefined) df[i] += 1; }); });
  const idf = new Float32Array(vocab.size);
  for(const [tok,i] of vocab.entries()) idf[i] = Math.log((N+1)/(df[i]+1)) + 1;
  const vectors = docsTokens.map(tokens=>{
    const tf = new Map();
    tokens.forEach(tok=>{ const i=vocab.get(tok); if(i!==undefined) tf.set(i,(tf.get(i)||0)+1); });
    const vec = new Map(); let norm=0;
    // use term frequency normalized by doc length to reduce bias from long docs
    for(const [i,cnt] of tf.entries()){ const val = (cnt / Math.max(1, tokens.length)) * (idf[i] || 1); vec.set(i,val); norm += val*val; }
    norm = Math.sqrt(norm) || 1;
    for(const [i,v] of vec.entries()) vec.set(i, v / norm);
    return vec;
  });
  return { vocab, idf, vectors, docsTokens };
}

// cosine similarity (sparse maps)
function tf_cosine(a,b){
  if(!a||!b) return 0;
  const [small,big] = a.size < b.size ? [a,b] : [b,a];
  let s=0;
  for(const [k,v] of small.entries()){
    const bv = big.get(k);
    if(bv) s += v * bv;
  }
  return s;
}

// greedy clustering (single-link style but with centroid update)
// threshold tuned to avoid many singletons; you can tweak `threshold` param when calling
function tf_greedy(vectors, threshold=0.38){
  const clusters=[];
  for(let i=0;i<vectors.length;i++){
    const vec = vectors[i] || new Map();
    // if empty vector, push as singleton for now (we'll filter singletons out later)
    if((vec && vec.size === 0) && vectors.length>0){
      clusters.push({ ids:[i], centroid:new Map() });
      continue;
    }
    let best = { idx:-1, sim:-1 };
    for(let c=0;c<clusters.length;c++){
      const sim = tf_cosine(vec, clusters[c].centroid || new Map());
      if(sim > best.sim){ best = { idx:c, sim }; }
    }
    if(best.idx !== -1 && best.sim >= threshold){
      clusters[best.idx].ids.push(i);
      // update centroid (component-wise sum then normalize)
      const centroid = new Map(clusters[best.idx].centroid);
      for(const [k,v] of vec.entries()) centroid.set(k, (centroid.get(k) || 0) + v);
      // normalize
      let norm = 0; for(const v of centroid.values()) norm += v*v; norm = Math.sqrt(norm) || 1;
      for(const [k,v] of centroid.entries()) centroid.set(k, v / norm);
      clusters[best.idx].centroid = centroid;
    } else {
      clusters.push({ ids:[i], centroid:new Map(vec) });
    }
  }
  return clusters;
}

// convert centroid (Map) -> top keywords using vocab map
function tf_topKeywords(centroid, vocabMap, k=4){
  if(!centroid || centroid.size===0) return [];
  const inv = [];
  for(const [tok,i] of vocabMap.entries()) inv[i] = tok;
  const arr = [];
  centroid.forEach((v,i) => arr.push([i,v]));
  arr.sort((a,b)=>b[1]-a[1]);
  return arr.slice(0,k).map(x=>inv[x[0]]).filter(Boolean);
}

function distance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // meters

    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;

    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) *
        Math.cos(φ2) *
        Math.sin(Δλ / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// main run function (keeps same return shape, but filters out singles)
function TFIDF_run(grievances){
  if(!grievances || !grievances.length) return [];
  // build corpus from title+desc
  const corpus = grievances.map(g => `${g.title||''} ${g.description||''}`.trim());
  const tf = tf_buildTfIdf(corpus);

  // greedy clustering
  const raw = tf_greedy(tf.vectors, 0.38); // adjust threshold if needed

  // build clusters with metadata; only keep groups size>=2
  const clusters = raw.map((c, idx) => {
    const ids = c.ids.slice(); // indices into grievances/corpus
    const sample = corpus[ids[0]] || '';
    // compute area: prefer explicit fields on grievances; fallback to detectArea(sample)
    
    // NEW LOCATION LOGIC USING LATITUDE/LONGITUDE

const areaCounts = {};

ids.forEach(i => {
  const g = grievances[i] || {};

  // First preference: already stored area/locality
  let locationName =
      g.area ||
      g.locality ||
      (g.hfEngine && (g.hfEngine.area || g.hfEngine.location));

  // If no area exists, create a location label from coordinates
  if (!locationName && g.latitude != null && g.longitude != null) {

    // Round coordinates so nearby complaints get grouped together
    const lat = Number(g.latitude).toFixed(3);
    const lon = Number(g.longitude).toFixed(3);

    locationName = `${lat}, ${lon}`;
  }

  // Final fallback to text detection
  if (!locationName) {
    locationName = tf_detectArea(corpus[i]);
  }

  if (locationName) {
    locationName = String(locationName).trim();
    areaCounts[locationName] =
      (areaCounts[locationName] || 0) + 1;
  }
});

const area = Object.keys(areaCounts).length
  ? Object.entries(areaCounts)
      .sort((a, b) => b[1] - a[1])[0][0]
  : "Unknown";
  
    const keywords = tf_topKeywords(c.centroid || new Map(), tf.vocab, 4);
    return { clusterId: 'cluster_' + Date.now() + '_' + idx, size: ids.length, ids, sample, area, keywords };
  }).filter(c => c.size >= 2); // remove singletons

  // sort by size descending
  clusters.sort((a,b) => b.size - a.size);

  return clusters;
}

// expose under window.TFIDF to preserve your existing integration
window.TFIDF = { run: TFIDF_run };
