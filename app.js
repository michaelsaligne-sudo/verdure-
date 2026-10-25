/* Verdure : carnet de soins des plantes. Données sur l'appareil, rappels par notification, identification Pl@ntNet. */
const PUSH_API = "https://tpautawxuufeontnhjjc.supabase.co/functions/v1/verdure-push";
const PLANTNET_API = "https://my-api.plantnet.org/v2/identify/all";
const VAPID_PUBLIC = "BNJ5yx2Z1b7uupvr7-3_36jMc1fuXQ3wZ7mT6uFsSo-YkeAHn1VLHM6HJTa7tAs0iU80KzDX5_o2j6VegFeaf0E";

/* ---------- utilitaires ---------- */
const $ = s => document.querySelector(s);
const DAY = 864e5;
const isoDate = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
const todayISO = () => isoDate(new Date());
const addDays = (iso, n) => isoDate(new Date(new Date(iso + "T12:00:00").getTime() + n * DAY));
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / DAY);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const bySpecies = id => CATALOG.find(c => c.id === id) || CATALOG[CATALOG.length - 1];
const plantName = p => p.name || bySpecies(p.species).nom;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }
function resize(file, max, q = .82) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => res({ blob: b, url: c.toDataURL("image/jpeg", q) }), "image/jpeg", q);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej; img.src = URL.createObjectURL(file);
  });
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};

/* ---------- plantes ---------- */
let plants = store.get("verdure.plants", []);
function save() {
  if (!store.set("verdure.plants", plants)) toast("Mémoire pleine : retirez quelques photos");
  render(); syncPush();
}
function savePlant(p) { const i = plants.findIndex(x => x.id === p.id); if (i < 0) plants.push(p); else plants[i] = p; save(); }
function removePlant(id) { plants = plants.filter(p => p.id !== id); save(); }

const defMist = c => /forte/i.test(c.humidite) ? 4 : 0;
const defFeed = c => /inutile|—/i.test(c.engrais) ? 0 : /2 fois|une fois|3 fois/i.test(c.engrais) ? 120 : 30;
const createdISO = p => p.created ? isoDate(p.created) : todayISO();
const TASKS = [
  { k: "water", verb: "Arroser", done: "Arrosé", every: p => p.every, last: p => p.last, set: (p, t) => ({ ...p, last: t }) },
  { k: "mist", verb: "Brumiser", done: "Brumisé", every: p => p.mistEvery || 0, last: p => p.mistLast || createdISO(p), set: (p, t) => ({ ...p, mistLast: t }) },
  { k: "feed", verb: "Engrais", done: "Engrais donné", every: p => p.feedEvery || 0, last: p => p.feedLast || createdISO(p), set: (p, t) => ({ ...p, feedLast: t }) },
  { k: "repot", verb: "Rempoter", done: "Rempoté", every: p => p.repotLast ? 730 : 0, last: p => p.repotLast, set: (p, t) => ({ ...p, repotLast: t }) }
];
const nextDate = (p, t) => { const e = t.every(p), l = t.last(p); return e && l ? addDays(l, e) : null; };
const due = (p, t) => { const n = nextDate(p, t); return n ? daysBetween(todayISO(), n) : null; };
const dueTasks = p => TASKS.filter(t => { const d = due(p, t); return d !== null && d <= 0; });
function status(p) {
  const d = due(p, TASKS[0]);
  if (d < 0) return { cls: "late", txt: `En retard de ${-d} j`, d };
  if (d === 0) return { cls: "due", txt: "À arroser aujourd'hui", d };
  return { cls: "", txt: d === 1 ? "Arrosage demain" : `Arrosage dans ${d} j`, d };
}

/* ---------- jardin ---------- */
function render() {
  const g = $("#garden");
  if (!plants.length) {
    g.innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>Votre jardin est vide</h3><p>Ajoutez vos plantes pour recevoir les rappels de soins. Commencez par une plante courante :</p><div class="row" style="justify-content:center">${["monstera", "pothos", "sansevieria", "orchidee"].map(id => `<button class="small" data-quick="${id}">${bySpecies(id).nom}</button>`).join("")}</div></div>`;
    $("#today").innerHTML = `<span class="eyebrow">Aujourd'hui</span><strong>Rien à faire pour l'instant.</strong>`;
  } else {
    const sorted = [...plants].sort((a, b) => status(a).d - status(b).d);
    g.innerHTML = sorted.map(p => {
      const s = status(p), c = bySpecies(p.species), title = plantName(p), extra = dueTasks(p).filter(t => t.k !== "water");
      return `<article class="plant">
        ${p.photo ? `<img class="thumb" src="${p.photo}" alt="">` : `<div class="thumb" aria-hidden="true">${esc(title[0])}</div>`}
        <div class="meta"><h3>${esc(title)}</h3><span class="latin">${esc(p.latin || c.latin || c.nom)}${p.room ? " · " + esc(p.room) : ""}</span>
          <div class="chips"><span class="chip ${s.cls}">${s.txt}</span><span class="chip">tous les ${p.every} j</span>${extra.map(t => `<span class="chip due">${t.verb}</span>`).join("")}</div>
          <div class="row"><button class="water small" data-water="${p.id}">Arrosé</button>${extra.map(t => `<button class="small" data-task="${t.k}" data-pid="${p.id}">${t.done}</button>`).join("")}<button class="small" data-edit="${p.id}">Modifier</button><button class="small ghost" data-info="${p.species}">Fiche</button></div>
        </div></article>`;
    }).join("");
    const todo = TASKS.map(t => ({ t, ps: plants.filter(p => { const d = due(p, t); return d !== null && d <= 0; }) })).filter(x => x.ps.length);
    const first = sorted[0];
    $("#today").innerHTML = `<span class="eyebrow">Aujourd'hui · ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>` +
      (todo.length ? todo.map(x => `<strong>${x.t.verb} : ${x.ps.map(p => esc(plantName(p))).join(", ")}</strong>`).join("")
        : `<strong>Rien à faire aujourd'hui. Prochain arrosage ${status(first).txt.replace("Arrosage ", "")}.</strong>`);
  }
  $("#dxPlant").innerHTML = `<option value="">Non précisée</option>` + plants.map(p => `<option value="${p.id}">${esc(plantName(p))}</option>`).join("");
}
$("#garden").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.quick) return openAdd({ species: b.dataset.quick });
  if (b.dataset.water) { const p = plants.find(x => x.id === b.dataset.water); savePlant({ ...p, last: todayISO() }); toast("Arrosage noté"); }
  if (b.dataset.task) { const p = plants.find(x => x.id === b.dataset.pid), t = TASKS.find(x => x.k === b.dataset.task); savePlant(t.set(p, todayISO())); toast(t.done + ", c'est noté"); }
  if (b.dataset.edit) openAdd(plants.find(x => x.id === b.dataset.edit));
  if (b.dataset.info) { show("fiches"); $("#catFilter").value = ""; $("#search").value = bySpecies(b.dataset.info).nom; renderCatalog(true); }
});

/* ---------- ajout / édition ---------- */
let editing = null, pendingPhoto = null, pendingLatin = "";
const sorted = list => [...list].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
$("#fSpecies").innerHTML = Object.entries(CATS).map(([k, label]) => `<optgroup label="${label}">` + sorted(CATALOG.filter(c => c.cat === k))
  .map(c => `<option value="${c.id}">${c.nom}${c.latin ? " (" + c.latin + ")" : ""}</option>`).join("") + `</optgroup>`).join("")
  + `<option value="autre">Autre plante</option>`;
$("#fSpecies").onchange = () => { const c = bySpecies($("#fSpecies").value); $("#fEvery").value = c.eau; $("#fMist").value = defMist(c); $("#fFeed").value = defFeed(c); };
function openAdd(p = {}) {
  editing = p.id ? p : null; pendingPhoto = p.photo || null; pendingLatin = p.latin || "";
  $("#addTitle").textContent = editing ? "Modifier la plante" : "Ajouter une plante";
  $("#fSpecies").value = p.species || "monstera";
  const c = bySpecies($("#fSpecies").value);
  $("#fName").value = p.name || ""; $("#fRoom").value = p.room || "";
  $("#fEvery").value = p.every || c.eau; $("#fLast").value = p.last || todayISO();
  $("#fMist").value = p.mistEvery ?? defMist(c); $("#fFeed").value = p.feedEvery ?? defFeed(c); $("#fRepot").value = p.repotLast || "";
  $("#fPhoto").value = ""; $("#fDelete").hidden = !editing;
  $("#addDlg").showModal();
}
$("#addBtn").onclick = () => openAdd();
$("#fCancel").onclick = () => $("#addDlg").close();
$("#fPhoto").onchange = async e => { const f = e.target.files[0]; if (f) pendingPhoto = (await resize(f, 200, .7)).url; };
$("#fDelete").onclick = () => {
  if ($("#fDelete").dataset.armed) { removePlant(editing.id); $("#addDlg").close(); toast("Plante retirée"); }
  else { $("#fDelete").dataset.armed = 1; $("#fDelete").textContent = "Confirmer le retrait"; }
};
$("#addDlg").addEventListener("close", () => { delete $("#fDelete").dataset.armed; $("#fDelete").textContent = "Retirer du jardin"; });
$("#addForm").onsubmit = e => {
  e.preventDefault();
  savePlant({
    id: editing?.id || ("p" + Date.now().toString(36)), created: editing?.created || Date.now(),
    species: $("#fSpecies").value, name: $("#fName").value.trim(), room: $("#fRoom").value.trim(),
    every: Math.max(1, parseInt($("#fEvery").value) || 7), last: $("#fLast").value || todayISO(),
    photo: pendingPhoto || "", latin: pendingLatin,
    mistEvery: Math.max(0, parseInt($("#fMist").value) || 0), mistLast: editing?.mistLast || "",
    feedEvery: Math.max(0, parseInt($("#fFeed").value) || 0), feedLast: editing?.feedLast || "",
    repotLast: $("#fRepot").value || ""
  });
  $("#addDlg").close(); toast(editing ? "Modifications enregistrées" : "Plante ajoutée au jardin");
};

/* ---------- identification (Pl@ntNet) ---------- */
let idImg = null;
function picker(drop, input, onPick) {
  drop.onclick = () => input.click();
  drop.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } };
  input.onchange = async () => { const f = input.files[0]; if (!f) return; const r = await resize(f, 1280); drop.innerHTML = `<img src="${r.url}" alt="Photo choisie"><span>Toucher pour changer</span>`; onPick(r); };
}
picker($("#idDrop"), $("#idFile"), r => { idImg = r; $("#idGo").disabled = false; });

function matchCatalog(sp) {
  const latin = (sp.scientificNameWithoutAuthor || "").toLowerCase();
  const genus = (sp.genus?.scientificNameWithoutAuthor || latin.split(" ")[0] || "").toLowerCase();
  const family = (sp.family?.scientificNameWithoutAuthor || "").toLowerCase();
  return CATALOG.find(c => c.latin && c.latin.toLowerCase() === latin)
    || CATALOG.find(c => c.latin && c.latin.toLowerCase().split(" ")[0] === genus)
    || CATALOG.find(c => c.latin && c.latin.toLowerCase() === family)
    || null;
}
$("#idGo").onclick = async () => {
  const out = $("#idOut"), key = store.get("verdure.plantnetKey", "");
  if (!key) { out.innerHTML = `<div class="card"><h3>Il manque la clé Pl@ntNet</h3><p class="note">Elle est gratuite. Ajoutez-la dans l'onglet Réglages.</p><button class="small" onclick="show('reglages')">Ouvrir les réglages</button></div>`; return; }
  $("#idGo").disabled = true; out.innerHTML = `<p class="note">Analyse de la photo…</p>`;
  const form = withKey => { const fd = new FormData(); fd.append("images", idImg.blob, "photo.jpg"); fd.append("organs", $("#idOrgan").value); if (withKey) fd.append("key", key); return fd; };
  try {
    // Appel direct (clé « exposée » + domaine autorisé sur my.plantnet.org), sinon relais par le serveur.
    let r = await fetch(`${PLANTNET_API}?api-key=${encodeURIComponent(key)}&lang=fr&nb-results=4`, { method: "POST", body: form(false) }).catch(() => null);
    if (!r || r.status === 401 || r.status === 403) r = await fetch(`${PUSH_API}/identify`, { method: "POST", body: form(true) });
    if (r.status === 404) { out.innerHTML = `<div class="card"><h3>Aucune plante reconnue</h3><p class="note">Essayez une photo plus proche d'une feuille ou d'une fleur, sur fond simple.</p></div>`; return; }
    if (r.status === 401 || r.status === 403) {
      const why = await r.json().then(j => j.message || j.error || "").catch(() => "");
      out.innerHTML = `<p class="note">Pl@ntNet refuse la clé (code ${r.status}${why ? " : " + esc(why) : ""}).<br>Sur my.plantnet.org, cochez « Expose my API key » et ajoutez <b>${esc(location.origin)}</b> dans « Authorized domains ».</p>`; return;
    }
    if (r.status === 429) { out.innerHTML = `<p class="note">Quota Pl@ntNet du jour atteint. Réessayez demain.</p>`; return; }
    if (!r.ok) throw new Error(r.status);
    const data = await r.json(), best = data.results?.[0];
    if (!best) { out.innerHTML = `<p class="note">Aucune plante reconnue. Essayez une autre photo.</p>`; return; }
    const sp = best.species, common = sp.commonNames?.[0] || sp.scientificNameWithoutAuthor, c = matchCatalog(sp);
    const others = data.results.slice(1).map(x => `${esc(x.species.commonNames?.[0] || x.species.scientificNameWithoutAuthor)} (${Math.round(x.score * 100)} %)`);
    out.innerHTML = `<div class="card">
      <div><span class="eyebrow">Fiabilité ${Math.round(best.score * 100)} %</span><h2>${esc(common)}</h2><span style="font-style:italic;color:var(--muted)">${esc(sp.scientificNameWithoutAuthor)} · ${esc(sp.family?.scientificNameWithoutAuthor || "")}</span></div>
      ${c && c.id !== "autre" ? `<div class="facts"><div class="fact"><b>Arrosage</b>tous les ${c.eau} j environ</div><div class="fact"><b>Lumière</b>${c.lumiere}</div><div class="fact"><b>Humidité</b>${c.humidite}</div><div class="fact"><b>Animaux</b>${c.toxique ? "Toxique" : "Sans danger connu"}</div></div><p>${c.conseil}</p>`
        : `<p class="note">Pas encore de fiche détaillée pour cette espèce : réglez la fréquence d'arrosage vous-même en l'ajoutant.</p>`}
      ${best.score < .3 ? `<p class="note">Fiabilité faible : comparez avec les autres possibilités.</p>` : ""}
      ${others.length ? `<p class="note">Autres possibilités : ${others.join(", ")}</p>` : ""}
      <button class="primary" id="idAdd">Ajouter à mon jardin</button></div>`;
    $("#idAdd").onclick = async () => {
      const thumb = (await resize(idImg.blob, 200, .7)).url;
      show("jardin");
      openAdd({ species: c ? c.id : "autre", name: c ? "" : common, latin: sp.scientificNameWithoutAuthor, photo: thumb });
    };
  } catch {
    out.innerHTML = `<p class="note">Pas de réponse de Pl@ntNet. Vérifiez votre connexion et réessayez.</p>`;
  } finally { $("#idGo").disabled = false; }
};

/* ---------- diagnostic par photo (Pl@ntNet, maladies et ravageurs) ---------- */
let dxImg = null;
picker($("#dxDrop"), $("#dxFile"), r => { dxImg = r; $("#dxGo").disabled = false; });
$("#dxGo").onclick = async () => {
  const out = $("#dxPhotoOut"), key = store.get("verdure.plantnetKey", "");
  if (!key) { out.innerHTML = `<p class="note">Ajoutez d'abord votre clé Pl@ntNet gratuite dans l'onglet Réglages.</p>`; return; }
  $("#dxGo").disabled = true; out.innerHTML = `<p class="note">Analyse de la photo…</p>`;
  const fd = new FormData(); fd.append("images", dxImg.blob, "photo.jpg");
  try {
    const r = await fetch(`https://my-api.plantnet.org/v2/diseases/identify?api-key=${encodeURIComponent(key)}&lang=fr&nb-results=3&include-related-images=true`, { method: "POST", body: fd });
    if (r.status === 404) { out.innerHTML = `<p class="note">Aucune maladie ni ravageur reconnu sur cette photo. Si la plante va mal, cochez les symptômes ci-dessous.</p>`; return; }
    if (r.status === 401 || r.status === 403) { out.innerHTML = `<p class="note">Pl@ntNet refuse la clé. Vérifiez-la dans Réglages.</p>`; return; }
    if (r.status === 429) { out.innerHTML = `<p class="note">Quota Pl@ntNet du jour atteint. Réessayez demain.</p>`; return; }
    if (!r.ok) throw new Error(r.status);
    const res = ((await r.json()).results || []).filter(x => x.score >= .05);
    if (!res.length) { out.innerHTML = `<p class="note">Rien de net sur cette photo. Essayez plus près de la zone abîmée, ou cochez les symptômes ci-dessous.</p>`; return; }
    out.innerHTML = res.map((x, i) => {
      const img = x.images?.[0]?.url?.s;
      return `<div class="plant" style="grid-template-columns:${img ? "72px 1fr" : "1fr"}">
        ${img ? `<img class="thumb" src="${esc(img)}" alt="Exemple de référence" loading="lazy">` : ""}
        <div class="meta"><span class="eyebrow">${i === 0 ? "Le plus probable" : "Autre possibilité"} · ${Math.round(x.score * 100)} %</span><h3>${esc(x.description || x.name)}</h3>
        ${img ? `<span class="note">Photo de référence : comparez avec votre plante.</span>` : ""}</div></div>`;
    }).join("") + `<p class="note">${res[0].score < .4 ? "Résultat incertain. " : ""}Ce modèle connaît surtout les maladies des plantes cultivées (potager, verger, vigne). Pour une plante d'intérieur, complétez avec les symptômes ci-dessous.</p>`;
  } catch {
    out.innerHTML = `<p class="note">Pas de réponse de Pl@ntNet. Vérifiez votre connexion et réessayez.</p>`;
  } finally { $("#dxGo").disabled = false; }
};

/* ---------- diagnostic par symptômes ---------- */
$("#symptoms").innerHTML = SYMPTOMS.map((s, i) => `<label><input type="checkbox" id="sy${i}" value="${s}">${s}</label>`).join("");
function renderDx() {
  const picked = [...document.querySelectorAll("#symptoms input:checked")].map(i => i.value);
  const p = plants.find(x => x.id === $("#dxPlant").value), c = p ? bySpecies(p.species) : null;
  const ctx = c && c.id !== "autre" ? `<div class="card"><span class="eyebrow">Rappel pour ${esc(plantName(p))}</span><p style="margin:0">Arrosage conseillé tous les ${c.eau} j (vous : ${p.every} j) · lumière ${c.lumiere.toLowerCase()} · humidité ${c.humidite.toLowerCase()}.</p></div>` : "";
  if (!picked.length) { $("#dxOut").innerHTML = `<p class="note">Cochez un ou plusieurs symptômes pour voir les causes probables et quoi faire.</p>`; return; }
  // Classement : symptômes qui correspondent, puis bonus si le problème touche souvent ce type de plante.
  const ranked = PROBLEMS.map(pb => {
    const hits = pb.sym.filter(x => picked.includes(x));
    const fits = c && c.id !== "autre" && (pb.pour.includes(c.id) || pb.pour.includes(c.cat));
    return { pb, hits, score: hits.length / Math.sqrt(pb.sym.length) + (hits.length && fits ? (pb.pour.includes(c.id) ? .5 : .25) : 0) };
  }).filter(r => r.hits.length).sort((x, y) => y.score - x.score).slice(0, 4);
  $("#dxOut").innerHTML = ctx + `<p class="note">Causes les plus probables${c && c.id !== "autre" ? " pour " + esc(c.nom.toLowerCase()) : ""} :</p>` + ranked.map((r, i) => `<details ${i === 0 ? "open" : ""}><summary>${esc(r.pb.nom)} <span class="pill">${r.pb.type}</span></summary>
    <p class="note">Correspond à : ${r.hits.map(esc).join(", ").toLowerCase()}</p><p><b>Pourquoi.</b> ${r.pb.cause}</p><p><b>Que faire.</b> ${r.pb.faire}</p><p><b>À l'avenir.</b> ${r.pb.prevenir}</p></details>`).join("");
}
$("#symptoms").onchange = renderDx; $("#dxPlant").onchange = renderDx;

/* ---------- fiches et lumière ---------- */
function renderCatalog(openFirst) {
  const q = $("#search").value.trim().toLowerCase();
  const f = $("#catFilter").value;
  const list = sorted(CATALOG.filter(c => c.id !== "autre" && (!f || c.cat === f) && (!q || (c.nom + " " + c.latin + " " + CATS[c.cat]).toLowerCase().includes(q))));
  $("#catalog").innerHTML = list.length ? list.map((c, i) => `<details ${openFirst && i === 0 ? "open" : ""}><summary>${c.nom} <span style="font-weight:400;font-style:italic;color:var(--muted)">${c.latin}</span></summary>
    <div class="facts" style="margin-top:10px"><div class="fact"><b>Arrosage</b>tous les ${c.eau} j environ</div><div class="fact"><b>Lumière</b>${c.lumiere}</div><div class="fact"><b>Humidité</b>${c.humidite}</div><div class="fact"><b>Température</b>${c.temp}</div><div class="fact"><b>Engrais</b>${c.engrais}</div><div class="fact"><b>Animaux</b>${c.toxique ? "Toxique" : "Sans danger connu"}</div></div>
    <p>${c.conseil}</p><button class="small" data-add="${c.id}">Ajouter à mon jardin</button></details>`).join("") : `<p class="note">Aucune fiche. Essayez l'onglet Identifier avec une photo.</p>`;
}
$("#catFilter").innerHTML = `<option value="">Toutes (${CATALOG.length - 1})</option>` + Object.entries(CATS).map(([k, l]) => `<option value="${k}">${l} (${CATALOG.filter(c => c.cat === k).length})</option>`).join("");
$("#search").oninput = () => renderCatalog(false); $("#catFilter").onchange = () => renderCatalog(false);
$("#catalog").addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (b) { show("jardin"); openAdd({ species: b.dataset.add }); } });
function renderLight() {
  const lvl = Math.max(0, Math.min(3, +$("#lOrient").value - +$("#lDist").value)), L = LIGHT[lvl];
  const fit = CATALOG.filter(c => c.id !== "autre" && L.match.test(c.lumiere) && !(lvl < 3 && /plein soleil/i.test(c.lumiere))).map(c => c.nom);
  $("#lOut").innerHTML = `<div class="facts"><div class="fact"><b>Lumière estimée</b>${L.nom}</div><div class="fact"><b>Environ</b>${L.lux}</div></div><p>${L.txt}</p>${fit.length ? `<p class="note">Plantes adaptées : ${fit.join(", ")}.</p>` : ""}`;
}
$("#lOrient").onchange = $("#lDist").onchange = renderLight;

/* ---------- notifications ---------- */
const standalone = () => window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const b64ToBytes = s => { const b = atob((s + "=".repeat((4 - s.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function currentSub() { if (!pushSupported()) return null; const reg = await navigator.serviceWorker.ready; return reg.pushManager.getSubscription(); }
function scheduleTasks() {
  return plants.flatMap(p => TASKS.map(t => { const n = nextDate(p, t); return n ? { due: n, text: `${t.k === "feed" ? "Engrais pour" : t.verb} ${plantName(p)}` } : null; }).filter(Boolean)).slice(0, 200);
}
async function api(route, body) {
  const r = await fetch(`${PUSH_API}/${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
  return r.json();
}
let syncTimer = null;
function syncPush() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try { const sub = await currentSub(); if (sub) await api("subscribe", { subscription: sub.toJSON(), tasks: scheduleTasks() }); }
    catch { /* hors ligne : on resynchronisera au prochain changement ou au prochain lancement */ }
  }, 1200);
}
async function renderNotif() {
  const st = $("#notifState"), on = $("#notifOn"), off = $("#notifOff"), test = $("#notifTest");
  if (!standalone() && /iphone|ipad/i.test(navigator.userAgent)) {
    st.textContent = "Sur iPhone, installez d'abord Verdure sur l'écran d'accueil (Safari, bouton Partager, « Sur l'écran d'accueil »), puis ouvrez-la depuis son icône.";
    on.hidden = true; off.hidden = true; test.hidden = true; return;
  }
  if (!pushSupported()) { st.textContent = "Ce navigateur ne gère pas les notifications. Sur iPhone, il faut iOS 16.4 ou plus récent."; on.hidden = off.hidden = test.hidden = true; return; }
  const sub = await currentSub().catch(() => null);
  if (Notification.permission === "denied") { st.textContent = "Notifications refusées. Réactivez-les dans Réglages iPhone, Notifications, Verdure."; on.hidden = off.hidden = test.hidden = true; return; }
  st.textContent = sub ? "Activées : un rappel chaque matin vers 8 h quand une plante a besoin de vous." : "Un rappel chaque matin vers 8 h quand une plante a besoin de vous.";
  on.hidden = !!sub; off.hidden = !sub; test.hidden = !sub;
}
$("#notifOn").onclick = async () => {
  try {
    if (await Notification.requestPermission() !== "granted") { renderNotif(); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
    await api("subscribe", { subscription: sub.toJSON(), tasks: scheduleTasks() });
    toast("Notifications activées");
  } catch { toast("Activation impossible pour l'instant. Réessayez avec une connexion."); }
  renderNotif();
};
$("#notifOff").onclick = async () => {
  const sub = await currentSub();
  if (sub) { api("unsubscribe", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
  toast("Notifications désactivées"); renderNotif();
};
$("#notifTest").onclick = async () => {
  const sub = await currentSub(); if (!sub) return renderNotif();
  try { await api("subscribe", { subscription: sub.toJSON(), tasks: scheduleTasks() }); await api("test", { endpoint: sub.endpoint }); toast("Essai envoyé : la notification arrive dans quelques secondes"); }
  catch { toast("L'essai n'est pas parti. Vérifiez la connexion."); }
};

/* ---------- réglages : clé Pl@ntNet, sauvegarde ---------- */
$("#siteOrigin").textContent = location.origin;
$("#pnKey").value = store.get("verdure.plantnetKey", "");
$("#pnSave").onclick = () => { const k = $("#pnKey").value.replace(/[\s"'«»]/g, ""); $("#pnKey").value = k; store.set("verdure.plantnetKey", k); toast("Clé enregistrée sur ce téléphone"); };
$("#backupOut").onclick = () => {
  const blob = new Blob([JSON.stringify({ app: "verdure", version: 1, saved: new Date().toISOString(), plants }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `verdure-${todayISO()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
$("#backupIn").onclick = () => $("#backupFile").click();
$("#backupFile").onchange = async e => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (data.app !== "verdure" || !Array.isArray(data.plants)) throw new Error();
    plants = data.plants; save(); toast(`${plants.length} plante(s) restaurée(s)`); show("jardin");
  } catch { toast("Ce fichier n'est pas une sauvegarde Verdure"); }
  e.target.value = "";
};

/* ---------- navigation ---------- */
function show(v) {
  document.querySelectorAll("section[id^=v-]").forEach(s => s.hidden = s.id !== "v-" + v);
  document.querySelectorAll("nav button").forEach(b => b.setAttribute("aria-current", b.dataset.v === v));
  if (v === "reglages") renderNotif();
  window.scrollTo(0, 0);
}
window.show = show;
document.querySelectorAll("nav button").forEach(b => b.onclick = () => show(b.dataset.v));
const h = location.hash.slice(1);
if (["jardin", "identifier", "diagnostic", "fiches", "reglages"].includes(h)) show(h);

$("#installHint").hidden = standalone() || !/iphone|ipad/i.test(navigator.userAgent);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").then(syncPush).catch(() => {});
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
render(); renderCatalog(false); renderLight(); renderDx();
