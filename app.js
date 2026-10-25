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

/* ---------- saison, météo, contexte ---------- */
const place = () => store.get("verdure.place", null);
/* Mois « climatique » : décalé de 6 mois dans l'hémisphère sud. */
const climMonth = (d = new Date()) => { const m = d.getMonth() + 1, pl = place(); return pl && pl.lat < 0 ? (m + 5) % 12 + 1 : m; };
const seasonOf = (m = climMonth()) => Object.keys(SEASONS).find(k => SEASONS[k].includes(m));
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const minTemp = c => { const n = parseFloat(String(c.temp).replace("−", "-")); return isNaN(n) ? 12 : n; };
const isOutside = p => p.outside ?? ["aromatique", "potager", "exterieur"].includes(bySpecies(p.species).cat);
function suggestedEvery(p) {
  const c = bySpecies(p.species); if (c.id === "autre") return null;
  const s = seasonOf(), f = (WATER_FACTOR[c.cat] || WATER_FACTOR.autre)[s] * (c.repos && s === "hiver" ? 1.4 : 1) * (isOutside(p) && s === "ete" ? .9 : 1);
  return Math.max(1, Math.round(c.eau * f));
}
let weather = store.get("verdure.weather", null);
async function loadWeather(force) {
  const pl = place(); if (!pl) { weather = null; return null; }
  if (!force && weather && weather.lat === pl.lat && weather.lon === pl.lon && Date.now() - weather.t < 3 * 36e5) return weather;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pl.lat}&longitude=${pl.lon}&current=temperature_2m,relative_humidity_2m&daily=temperature_2m_min,temperature_2m_max,precipitation_sum&timezone=auto&forecast_days=7`);
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    weather = { t: Date.now(), lat: pl.lat, lon: pl.lon, temp: j.current.temperature_2m, hum: j.current.relative_humidity_2m,
      days: j.daily.time.map((d, i) => ({ date: d, min: j.daily.temperature_2m_min[i], max: j.daily.temperature_2m_max[i], rain: j.daily.precipitation_sum[i] })) };
    store.set("verdure.weather", weather);
  } catch { /* hors ligne : on garde la dernière météo connue */ }
  return weather;
}
const dayName = iso => iso === todayISO() ? "aujourd'hui" : iso === addDays(todayISO(), 1) ? "demain" : new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long" });
const coming = (n = 3) => (weather?.days || []).filter(d => d.date >= todayISO()).slice(0, n);
/* Alertes du moment, calculées à partir des plantes du jardin et des prévisions. */
function weatherAlerts() {
  const out = [], days = coming(3); if (!days.length) return out;
  const coldest = days.reduce((a, d) => d.min < a.min ? d : a), hottest = days.reduce((a, d) => d.max > a.max ? d : a);
  const outside = plants.filter(isOutside), inside = plants.filter(p => !isOutside(p));
  const atRisk = outside.filter(p => coldest.min < minTemp(bySpecies(p.species)) + 2);
  if (atRisk.length) out.push({ k: coldest.min <= 0 ? "gel" : "froid", txt: `${coldest.min <= 0 ? "Gel" : "Nuit fraîche"} annoncé${coldest.min <= 0 ? "" : "e"} ${dayName(coldest.date)} (${Math.round(coldest.min)} °C) : ${atRisk.map(p => esc(plantName(p))).join(", ")} ${atRisk.length > 1 ? "risquent" : "risque"} de souffrir. Rentrez ${atRisk.length > 1 ? "les plus fragiles" : "la plante"} ou protégez avec un voile d'hivernage, pot surélevé.` });
  if (hottest.max >= 30) out.push({ k: "chaleur", txt: `Forte chaleur ${dayName(hottest.date)} (${Math.round(hottest.max)} °C) : ${outside.length ? "arrosez les pots dehors tôt le matin ou le soir, ombrez l'après-midi ; " : ""}éloignez les plantes d'intérieur des vitres au soleil. Ni engrais ni rempotage.` });
  const rain = days.slice(0, 2).reduce((a, d) => a + (d.rain || 0), 0);
  if (rain >= 6 && outside.length) out.push({ k: "pluie", txt: `Pluie annoncée (${Math.round(rain)} mm d'ici demain) : inutile d'arroser les pots exposés à la pluie. Videz les soucoupes après l'averse.`, btn: "rain" });
  if (inside.length && ["automne", "hiver"].includes(seasonOf()) && (weather.temp ?? 20) < 12) {
    const humid = inside.filter(p => /forte/i.test(bySpecies(p.species).humidite));
    out.push({ k: "chauffage", txt: `Chauffage allumé, air sec à l'intérieur${humid.length ? " : " + humid.map(p => esc(plantName(p))).join(", ") + " " + (humid.length > 1 ? "aiment" : "aime") + " l'humidité, posez-" + (humid.length > 1 ? "les" : "la") + " sur une soucoupe de billes d'argile humides, loin du radiateur" : " : éloignez les plantes des radiateurs"}.` });
  }
  return out;
}
function renderSeason() {
  const s = seasonOf(), m = climMonth(), box = $("#season"), pl = place();
  const cats = [...new Set((plants.length ? plants.map(p => bySpecies(p.species).cat) : ["interieur"]).filter(c => c !== "autre"))];
  const cal = CALENDAR.filter(x => x.mois.includes(m) && cats.includes(x.cat));
  const adjust = plants.map(p => ({ p, n: suggestedEvery(p) })).filter(x => x.n && Math.abs(x.n - x.p.every) >= Math.max(2, x.p.every * .25));
  const alerts = weatherAlerts();
  box.innerHTML = `<span class="eyebrow">${SEASON_NAMES[s]} · ${MONTHS[new Date().getMonth()]}${pl ? " · " + esc(pl.name) : ""}${weather && pl ? ` · ${Math.round(weather.temp)} °C` : ""}</span>
    ${alerts.map(a => `<div class="alert ${a.k}"><p>${a.txt}</p>${a.btn ? `<button class="small" data-rain="1">Noter les pots dehors comme arrosés</button>` : ""}</div>`).join("")}
    ${adjust.length ? `<div><p><b>Arrosage de saison.</b> ${s === "hiver" ? "En hiver, les plantes boivent beaucoup moins." : s === "ete" ? "En été, les besoins augmentent." : s === "automne" ? "Avec l'automne, espacez les arrosages." : "Au printemps, la pousse repart : rapprochez les arrosages."} Conseillé : ${adjust.map(x => `${esc(plantName(x.p))} tous les ${x.n} j (au lieu de ${x.p.every})`).join(", ")}.</p><button class="small" id="applySeason">Adapter mes rappels</button></div>` : ""}
    ${cal.length ? `<div><p><b>Ce mois-ci</b></p><ul>${cal.map(x => `<li>${x.txt}</li>`).join("")}</ul></div>` : ""}
    ${pl ? "" : `<p class="note">Indiquez votre ville dans Réglages pour recevoir les alertes météo (gel, canicule, pluie).</p>`}`;
  const ap = $("#applySeason");
  if (ap) ap.onclick = () => { adjust.forEach(x => { x.p.every = x.n; }); save(); toast("Rappels adaptés à la saison"); };
}
$("#season").addEventListener("click", e => {
  if (!e.target.closest("[data-rain]")) return;
  plants = plants.map(p => isOutside(p) ? { ...p, last: todayISO() } : p); save(); toast("Pots dehors notés comme arrosés");
});

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
  const sel = $("#dxPlant").value;
  $("#dxPlant").innerHTML = `<option value="">Non précisée</option>` + plants.map(p => `<option value="${p.id}">${esc(plantName(p))}</option>`).join("");
  $("#dxPlant").value = plants.some(p => p.id === sel) ? sel : "";
  renderSeason();
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
$("#fSpecies").onchange = () => { const c = bySpecies($("#fSpecies").value); $("#fEvery").value = c.eau; $("#fMist").value = defMist(c); $("#fFeed").value = defFeed(c); $("#fOut").value = isOutside({ species: c.id }) ? "1" : "0"; };
function openAdd(p = {}) {
  editing = p.id ? p : null; pendingPhoto = p.photo || null; pendingLatin = p.latin || "";
  $("#addTitle").textContent = editing ? "Modifier la plante" : "Ajouter une plante";
  $("#fSpecies").value = p.species || "monstera";
  const c = bySpecies($("#fSpecies").value);
  $("#fName").value = p.name || ""; $("#fRoom").value = p.room || ""; $("#fOut").value = isOutside({ species: c.id, outside: p.outside }) ? "1" : "0";
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
    species: $("#fSpecies").value, name: $("#fName").value.trim(), room: $("#fRoom").value.trim(), outside: $("#fOut").value === "1",
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

/* ---------- diagnostic : moteur commun ---------- */
const PB = id => PROBLEMS.find(x => x.id === id);
const dxPlantSel = () => { const p = plants.find(x => x.id === $("#dxPlant").value); return p ? { p, c: bySpecies(p.species) } : { p: null, c: null }; };
/* Indices tirés de l'historique de soins, de la saison et de la météo : { idProblème: [bonus, raison] } */
function careClues(p, c) {
  const clues = {}, add = (ids, w, why) => ids.forEach(id => { const x = clues[id] || [0, []]; x[0] += w; if (why && !x[1].includes(why)) x[1].push(why); clues[id] = x; });
  const s = seasonOf(), m = climMonth();
  if (p && c && c.id !== "autre") {
    const sug = suggestedEvery(p);
    if (sug && p.every < sug * .7) add(["exceseau", "pourritureracines", "sciarides", "moisissureterre", "oedeme"], .5, `Vous arrosez tous les ${p.every} j ; en ${SEASON_NAMES[s].toLowerCase()}, ${c.nom.toLowerCase()} a besoin d'eau environ tous les ${sug} j.`);
    if (sug && p.every > sug * 1.6) add(["manqueeau", "terrehydrophobe"], .5, `Vous arrosez tous les ${p.every} j ; il en faudrait plutôt tous les ${sug} j en ce moment.`);
    const late = due(p, TASKS[0]); if (late !== null && late < -3) add(["manqueeau", "terrehydrophobe"], .3, `Le dernier arrosage noté date de ${daysBetween(p.last, todayISO())} j.`);
    const perennial = !/annuelle|bisannuel/i.test(c.r || "");
    if (perennial && (!p.repotLast || daysBetween(p.repotLast, todayISO()) > 730)) add(["potpetit", "terreepuisee"], .3, p.repotLast ? `Dernier rempotage il y a plus de 2 ans.` : `Pas de rempotage noté depuis que la plante est dans l'appli.`);
    if (p.created && Date.now() - p.created < 21 * DAY) add(["chocchangement"], .5, "La plante est arrivée il y a moins de 3 semaines.");
    if (c.repos && s === "hiver") add(["reposhiver"], .3, `${c.nom} marque un repos en hiver.`);
    (c.f || []).forEach(id => add([id], .25));
    const days = (weather?.days || []).filter(d => d.date >= addDays(todayISO(), -1)).slice(0, 4);
    if (days.length && isOutside(p)) {
      const lo = Math.min(...days.map(d => d.min)), hi = Math.max(...days.map(d => d.max));
      if (lo <= 0) add(["gel"], .6, `Gel annoncé ou récent (${Math.round(lo)} °C) et la plante est dehors.`);
      else if (lo < minTemp(c)) add(["froid"], .4, `Nuits à ${Math.round(lo)} °C, sous le minimum de ${c.nom.toLowerCase()} (${minTemp(c)} °C).`);
      if (hi >= 30) add(["chaleur", "manqueeau", "montee"], .4, `Fortes chaleurs (${Math.round(hi)} °C).`);
    }
    if (!isOutside(p) && ["automne", "hiver"].includes(s)) add(["airsec", "araignee"], .15, "Saison de chauffage : l'air intérieur est sec.");
  }
  PROBLEMS.forEach(pb => { if (pb.quand) add([pb.id], pb.quand.includes(m) ? .15 : -.35); });
  return clues;
}
function rankProblems(picked, p, c) {
  const clues = careClues(p, c);
  return PROBLEMS.map(pb => {
    const hits = pb.sym.filter(x => picked.includes(x));
    const fits = c && c.id !== "autre" && (pb.pour.includes(c.id) ? .4 : pb.pour.includes(c.cat) ? .2 : 0);
    const [bonus, why] = clues[pb.id] || [0, []];
    return { pb, hits, why, score: hits.length / Math.sqrt(pb.sym.length) + (hits.length ? (fits || 0) + bonus : 0) };
  }).filter(r => r.hits.length).sort((a, b) => b.score - a.score);
}
/* Conseil complet pour un problème, adapté à la saison et aux besoins de la plante. */
function adviceHTML(pb, c) {
  const s = seasonOf(), notes = [], nom = c && c.id !== "autre" ? c.nom : null;
  if (nom && c.e && ["potpetit", "terreepuisee", "floraison"].includes(pb.id)) notes.push(`${nom} aime être un peu à l'étroit : ne changez de pot que si les racines sortent nettement ou déforment le pot, et prenez alors un pot à peine plus grand (2 cm).`);
  if (nom && c.repos && ["automne", "hiver"].includes(s) && ["exceseau", "pourritureracines", "oedeme", "reposhiver"].includes(pb.id)) notes.push(`${nom} est au repos en cette saison : ${c.h}`);
  if (nom && ["potpetit", "pourritureracines", "cochenilleracinaire", "terreepuisee", "exceseau", "terrehydrophobe"].includes(pb.id) && c.s) notes.push(`Pour ${nom.toLowerCase()} : ${c.s} ${c.r || ""}`);
  if (nom && pb.id === "froid") notes.push(`${nom} supporte au minimum ${minTemp(c)} °C.`);
  return `<div class="steps">
    <div class="step now"><b>Tout de suite</b><p>${pb.vite}</p></div>
    <div class="step"><b>Ensuite</b><p>${pb.faire}</p></div>
    ${pb.saison?.[s] ? `<div class="step season"><b>En ce moment (${SEASON_NAMES[s].toLowerCase()})</b><p>${pb.saison[s]}</p></div>` : ""}
    ${notes.map(n => `<div class="step need"><b>Besoin de la plante</b><p>${esc(n)}</p></div>`).join("")}
    <div class="step"><b>Pour éviter que ça revienne</b><p>${pb.prevenir}</p></div></div>`;
}
const pbCard = (pb, c, open, head = "") => `<details ${open ? "open" : ""}><summary>${esc(pb.nom)} <span class="pill">${pb.type}</span></summary>${head}<p class="note">${pb.cause}</p>${adviceHTML(pb, c)}</details>`;

/* ---------- diagnostic par photo : Gemini (précis), sinon Pl@ntNet ---------- */
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
let dxImg = null;
picker($("#dxDrop"), $("#dxFile"), r => { dxImg = r; $("#dxGo").disabled = false; });
const DX_SCHEMA = {
  type: "object",
  properties: {
    photo_exploitable: { type: "boolean", description: "false si la photo est floue, trop sombre, trop loin ou ne montre pas de plante" },
    plante_vue: { type: "string", description: "Nom courant de la plante vue sur la photo" },
    etat_general: { type: "string", enum: ["bon", "moyen", "mauvais", "critique"] },
    observations: { type: "array", maxItems: 5, items: { type: "string" }, description: "Ce qui est réellement visible, précis et localisé (ex. « 3 feuilles du bas jaunes, nervures comprises »)" },
    diagnostics: { type: "array", maxItems: 3, items: { type: "object", properties: {
      base_id: { type: "string", enum: [...PROBLEMS.map(x => x.id), "aucun", "autre"] },
      nom: { type: "string" }, certitude: { type: "integer", minimum: 0, maximum: 100 },
      indices: { type: "string", description: "Pourquoi : signes visibles et éléments du contexte qui appuient ce diagnostic" } },
      required: ["base_id", "nom", "certitude", "indices"] } },
    tout_de_suite: { type: "array", maxItems: 4, items: { type: "string" }, description: "Gestes concrets à faire aujourd'hui, adaptés à la saison, à la météo et aux besoins de cette plante" },
    ensuite: { type: "array", maxItems: 5, items: { type: "string" }, description: "Gestes des prochaines semaines, avec le bon moment (ex. « en mars, rempoter dans un pot de 16 cm »)" },
    a_eviter: { type: "array", maxItems: 3, items: { type: "string" } },
    pour_confirmer: { type: "string", description: "Un test simple que la personne peut faire pour confirmer (ex. enfoncer un doigt, regarder sous les feuilles, dépoter)" }
  },
  required: ["photo_exploitable", "plante_vue", "etat_general", "observations", "diagnostics", "tout_de_suite", "ensuite", "a_eviter", "pour_confirmer"]
};
function dxContext(p, c) {
  const s = seasonOf(), days = coming(4);
  const ctx = { date: todayISO(), saison: SEASON_NAMES[s], mois: MONTHS[new Date().getMonth()], hemisphere: place()?.lat < 0 ? "sud" : "nord" };
  if (weather && place()) ctx.meteo = { ville: place().name, temperature_actuelle: weather.temp, humidite_air_exterieur: weather.hum, prochains_jours: days.map(d => `${d.date} : ${d.min} à ${d.max} °C, pluie ${d.rain} mm`) };
  if (p) {
    ctx.plante_choisie = { nom: plantName(p), espece: c.id === "autre" ? (p.latin || "inconnue") : `${c.nom} (${c.latin})`, emplacement: isOutside(p) ? "dehors" : "intérieur", piece: p.room || undefined,
      arrosage_utilisateur: `tous les ${p.every} j, dernier il y a ${daysBetween(p.last, todayISO())} j`, dernier_rempotage: p.repotLast || "inconnu",
      dans_l_appli_depuis: p.created ? `${Math.round((Date.now() - p.created) / DAY)} j` : undefined };
    if (c.id !== "autre") ctx.besoins_espece = { arrosage_conseille: `tous les ${c.eau} j en saison, environ ${suggestedEvery(p)} j en ce moment`, lumiere: c.lumiere, humidite: c.humidite, temperature: c.temp,
      aime_etre_a_l_etroit: !!c.e, repos_hivernal: !!c.repos, substrat: c.s, rempotage: c.r, hiver: c.h, soucis_frequents: (c.f || []).map(id => PB(id).nom) };
  }
  const note = $("#dxNote").value.trim(); if (note) ctx.remarque_utilisateur = note.slice(0, 500);
  return ctx;
}
/* Réponse en flux (SSE) : les « pensées » de Gemini arrivent au fil de l'eau et gardent la connexion active,
   sinon Safari coupe les requêtes longues (« Load failed »). En cas d'échec réseau, relais par la fonction serveur. */
const geminiFetch = (key, model, body, relay) => fetch(relay ? `${PUSH_API}/gemini?model=${model}` : `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
  { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
async function geminiCall(key, body) {
  for (const model of GEMINI_MODELS) {
    let r;
    try { r = await geminiFetch(key, model, body, false); }
    catch { r = await geminiFetch(key, model, body, true); }
    if ([404, 429, 500, 503].includes(r.status) && model !== GEMINI_MODELS.at(-1)) continue;
    return r;
  }
}
async function readGemini(r, onThought) {
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = "", text = "", finish = "";
  const line = l => {
    if (!l.startsWith("data:")) return;
    let j; try { j = JSON.parse(l.slice(5)); } catch { return; }
    const cand = j.candidates?.[0];
    finish = cand?.finishReason || j.promptFeedback?.blockReason || finish;
    for (const part of cand?.content?.parts || []) { if (part.thought) onThought(); else text += part.text || ""; }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n")) >= 0) { line(buf.slice(0, i).trim()); buf = buf.slice(i + 1); }
  }
  line(buf.trim());
  return { text, finish };
}
async function aiDiagnose(key, p, c) {
  const b64 = dxImg.url.split(",")[1];
  const prompt = `Tu es horticulteur et phytopathologiste, spécialiste des plantes d'intérieur, aromatiques et potagères. Tu examines la photo d'une plante envoyée par un particulier débutant.
Méthode : 1) décris précisément ce qui est visible (partie de la plante, couleur, motif des taches, position des feuilles touchées : bas, haut, jeunes, vieilles ; insectes ; état de la terre et du pot si visibles). 2) Croise avec le contexte (espèce et ses besoins, arrosages, rempotage, emplacement, saison, météo). 3) Donne au plus 3 diagnostics classés, avec une certitude honnête ; n'invente rien qui ne soit pas visible ou déductible. Utilise base_id quand un problème de la base correspond ; « aucun » si la plante est saine ; « autre » sinon. 4) Donne des gestes concrets, chiffrés et datés, adaptés à la saison en cours, à la météo et aux besoins de l'espèce (par exemple : ne pas rempoter en hiver mais attendre mars, sauf urgence comme une pourriture ; ne pas donner d'engrais en hiver ; pot à peine plus grand pour une plante qui aime être à l'étroit). Privilégie les solutions douces (savon noir, bicarbonate, douche) et cite un produit seulement s'il est nécessaire. Si la photo ne suffit pas, mets photo_exploitable à false et explique dans pour_confirmer quelle photo prendre.
Écris en français simple, en vouvoyant, phrases courtes.
Base de problèmes connus (id : nom) : ${PROBLEMS.map(x => `${x.id} : ${x.nom}`).join(" ; ")}.
Contexte : ${JSON.stringify(dxContext(p, c))}`;
  const contents = [{ parts: [{ inline_data: { mime_type: "image/jpeg", data: b64 } }, { text: prompt }] }];
  const thinking = { thinkingLevel: "low", includeThoughts: true };
  let r = await geminiCall(key, { contents, generationConfig: { maxOutputTokens: 8192, thinkingConfig: thinking, responseFormat: { text: { mimeType: "APPLICATION_JSON", schema: DX_SCHEMA } } } });
  if (r.status === 400) {
    const err = await r.clone().json().catch(() => ({}));
    if (!/API key|API_KEY/i.test(JSON.stringify(err))) r = await geminiCall(key, { contents, generationConfig: { maxOutputTokens: 8192, thinkingConfig: { includeThoughts: true }, responseMimeType: "application/json", responseJsonSchema: DX_SCHEMA } });
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({})), msg = err.error?.message || "";
    const e = new Error(msg); e.status = r.status; throw e;
  }
  const t0 = Date.now(), tick = () => { $("#dxPhotoOut").innerHTML = `<p class="note">L'expert examine la photo… ${Math.round((Date.now() - t0) / 1000)} s</p>`; };
  const { text: txt, finish } = await readGemini(r, tick);
  const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
  if (a < 0 || b < a) { const e = new Error(`réponse vide (${finish || "sans motif"})`); e.parse = true; throw e; }
  try { return JSON.parse(txt.slice(a, b + 1)); }
  catch { const e = new Error(`réponse incomplète (${finish || "illisible"})`); e.parse = true; throw e; }
}
const certLabel = n => n >= 75 ? "très probable" : n >= 50 ? "probable" : n >= 25 ? "possible" : "peu probable";
function renderAi(res, c) {
  const out = $("#dxPhotoOut"), list = items => items?.length ? `<ul>${items.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  if (!res.photo_exploitable) { out.innerHTML = `<div class="card"><h3>Photo difficile à analyser</h3><p>${esc(res.pour_confirmer)}</p></div>`; return; }
  const dx = (res.diagnostics || []).sort((a, b) => b.certitude - a.certitude), main = dx[0];
  const healthy = !main || main.base_id === "aucun";
  out.innerHTML = `<div class="card result">
      <span class="eyebrow">${esc(res.plante_vue)} · état ${esc(res.etat_general)}</span>
      <h2>${healthy ? "Pas de problème visible" : esc(main.nom)}</h2>
      ${main && !healthy ? `<p class="note">${certLabel(main.certitude)} (${main.certitude} %) · ${esc(main.indices)}</p>` : ""}
      ${res.observations?.length ? `<div><b>Ce que l'on voit</b>${list(res.observations)}</div>` : ""}
    </div>
    ${res.tout_de_suite?.length ? `<div class="step now"><b>À faire tout de suite</b>${list(res.tout_de_suite)}</div>` : ""}
    ${res.ensuite?.length ? `<div class="step"><b>Ensuite</b>${list(res.ensuite)}</div>` : ""}
    ${res.a_eviter?.length ? `<div class="step avoid"><b>À éviter</b>${list(res.a_eviter)}</div>` : ""}
    ${res.pour_confirmer ? `<div class="step"><b>Pour confirmer</b><p>${esc(res.pour_confirmer)}</p></div>` : ""}
    ${dx.slice(1).filter(d => d.base_id !== "aucun").length ? `<p class="note">Autres pistes : ${dx.slice(1).filter(d => d.base_id !== "aucun").map(d => `${esc(d.nom)} (${certLabel(d.certitude)})`).join(", ")}</p>` : ""}
    ${dx.filter(d => PB(d.base_id)).length ? `<h3>Fiches conseil</h3>` + dx.filter(d => PB(d.base_id)).map((d, i) => pbCard(PB(d.base_id), c, false)).join("") : ""}
    <p class="note">Analyse par intelligence artificielle (Google Gemini) : faites le test « pour confirmer » avant un geste important comme un dépotage.</p>`;
}
async function plantnetDiagnose(key) {
  const out = $("#dxPhotoOut"), fd = new FormData(); fd.append("images", dxImg.blob, "photo.jpg");
  const r = await fetch(`https://my-api.plantnet.org/v2/diseases/identify?api-key=${encodeURIComponent(key)}&lang=fr&nb-results=3&include-related-images=true`, { method: "POST", body: fd });
  if (r.status === 404) { out.innerHTML = `<p class="note">Aucune maladie ni ravageur reconnu sur cette photo. Si la plante va mal, cochez les symptômes ci-dessous.</p>`; return; }
  if (r.status === 401 || r.status === 403) { out.innerHTML = `<p class="note">Pl@ntNet refuse la clé. Vérifiez-la dans Réglages.</p>`; return; }
  if (r.status === 429) { out.innerHTML = `<p class="note">Quota Pl@ntNet du jour atteint. Réessayez demain.</p>`; return; }
  if (!r.ok) throw new Error(r.status);
  const res = ((await r.json()).results || []).filter(x => x.score >= .05);
  const hint = `<div class="card"><p class="note">Pour un diagnostic précis des plantes d'intérieur et des aromatiques, avec les gestes à faire tout de suite, ajoutez une clé Gemini gratuite dans Réglages.</p><button class="small" onclick="show('reglages')">Ouvrir les réglages</button></div>`;
  if (!res.length) { out.innerHTML = `<p class="note">Rien de net sur cette photo. Essayez plus près de la zone abîmée, ou cochez les symptômes ci-dessous.</p>` + hint; return; }
  out.innerHTML = res.map((x, i) => {
    const img = x.images?.[0]?.url?.s;
    return `<div class="plant" style="grid-template-columns:${img ? "72px 1fr" : "1fr"}">
      ${img ? `<img class="thumb" src="${esc(img)}" alt="Exemple de référence" loading="lazy">` : ""}
      <div class="meta"><span class="eyebrow">${i === 0 ? "Le plus probable" : "Autre possibilité"} · ${Math.round(x.score * 100)} %</span><h3>${esc(x.description || x.name)}</h3>
      ${img ? `<span class="note">Photo de référence : comparez avec votre plante.</span>` : ""}</div></div>`;
  }).join("") + `<p class="note">Ce modèle connaît surtout les maladies des cultures (potager, verger, vigne).</p>` + hint;
}
$("#dxGo").onclick = async () => {
  const out = $("#dxPhotoOut"), gm = store.get("verdure.geminiKey", ""), pn = store.get("verdure.plantnetKey", ""), { p, c } = dxPlantSel();
  if (!gm && !pn) { out.innerHTML = `<div class="card"><h3>Il manque une clé</h3><p class="note">Ajoutez une clé Gemini gratuite dans Réglages pour le diagnostic photo.</p><button class="small" onclick="show('reglages')">Ouvrir les réglages</button></div>`; return; }
  $("#dxGo").disabled = true; out.innerHTML = `<p class="note">Analyse de la photo${gm ? " par un expert virtuel, environ 10 secondes" : ""}…</p>`;
  try {
    if (place()) await loadWeather();
    if (gm) {
      let res;
      try { res = await aiDiagnose(gm, p, c); }
      catch (e) { if (!e.status && !e.parse) e.message = "connexion à Gemini impossible : " + e.message; throw e; }
      renderAi(res, c);
    } else await plantnetDiagnose(pn);
  } catch (e) {
    const s = e.status;
    if (!s) { out.innerHTML = `<p class="note">L'analyse n'a pas abouti : ${esc(e.message || String(e))}. Réessayez ; si ça recommence, envoyez-moi une capture de ce message.</p>`; return; }
    out.innerHTML = `<p class="note">${s === 400 || s === 401 || s === 403 ? `Google refuse la clé Gemini (code ${s}). Vérifiez-la dans Réglages.` : s === 429 ? "Quota gratuit Gemini atteint pour le moment. Réessayez dans une minute, ou demain." : s ? `Gemini ne répond pas (code ${s}${e.message ? " : " + esc(e.message.slice(0, 120)) : ""}). Réessayez.` : "Pas de réponse. Vérifiez votre connexion et réessayez."}</p>`;
  } finally { $("#dxGo").disabled = false; }
};

/* ---------- diagnostic par symptômes ---------- */
$("#symptoms").innerHTML = SYMPTOM_GROUPS.map(g => `<p class="eyebrow" style="margin:10px 0 6px">${g.g}</p><div class="sym">${g.items.map(s => `<label><input type="checkbox" value="${esc(s)}">${esc(s)}</label>`).join("")}</div>`).join("");
function renderDx() {
  const picked = [...document.querySelectorAll("#symptoms input:checked")].map(i => i.value), { p, c } = dxPlantSel();
  $("#dxCtx").innerHTML = p && c.id !== "autre" ? `${esc(plantName(p))} : arrosage conseillé tous les ${suggestedEvery(p)} j en ce moment (vous : ${p.every} j) · lumière ${c.lumiere.toLowerCase()} · humidité ${c.humidite.toLowerCase()}${c.e ? " · aime être à l'étroit" : ""}${c.repos ? " · repos en hiver" : ""}.` : "Choisissez la plante pour un diagnostic adapté à ses besoins et à vos soins.";
  if (!picked.length) { $("#dxOut").innerHTML = `<p class="note">Cochez un ou plusieurs symptômes pour voir les causes probables et quoi faire.</p>`; return; }
  const ranked = rankProblems(picked, p, c).slice(0, 4), top = ranked[0]?.score || 1;
  $("#dxOut").innerHTML = `<p class="note">Causes les plus probables${c && c.id !== "autre" ? " pour " + esc(c.nom.toLowerCase()) : ""}, de la plus probable à la moins probable :</p>` +
    ranked.map((r, i) => pbCard(r.pb, c, i === 0, `<p class="note">${r.score >= top * .8 ? "Très compatible" : "Compatible"} · signes : ${r.hits.map(esc).join(", ").toLowerCase()}${r.why.length ? "<br>" + r.why.map(esc).join("<br>") : ""}</p>`)).join("");
}
$("#symptoms").onchange = renderDx; $("#dxPlant").onchange = renderDx;

/* ---------- fiches et lumière ---------- */
const ficheMore = c => `<div class="steps">${c.s ? `<div class="step"><b>Terre</b><p>${c.s}</p></div>` : ""}${c.r ? `<div class="step"><b>Rempotage</b><p>${c.r}${c.e ? " Elle aime être un peu à l'étroit : pot à peine plus grand." : ""}</p></div>` : ""}${c.h ? `<div class="step"><b>En hiver</b><p>${c.h}</p></div>` : ""}${c.t ? `<div class="step"><b>Taille et multiplication</b><p>${c.t}</p></div>` : ""}${c.f?.length ? `<div class="step"><b>Soucis fréquents</b><p>${c.f.map(id => PB(id).nom).join(", ")}</p></div>` : ""}</div>`;
function renderCatalog(openFirst) {
  const q = $("#search").value.trim().toLowerCase();
  const f = $("#catFilter").value;
  const list = sorted(CATALOG.filter(c => c.id !== "autre" && (!f || c.cat === f) && (!q || (c.nom + " " + c.latin + " " + CATS[c.cat]).toLowerCase().includes(q))));
  $("#catalog").innerHTML = list.length ? list.map((c, i) => `<details ${openFirst && i === 0 ? "open" : ""}><summary>${c.nom} <span style="font-weight:400;font-style:italic;color:var(--muted)">${c.latin}</span></summary>
    <div class="facts" style="margin-top:10px"><div class="fact"><b>Arrosage</b>tous les ${c.eau} j environ</div><div class="fact"><b>Lumière</b>${c.lumiere}</div><div class="fact"><b>Humidité</b>${c.humidite}</div><div class="fact"><b>Température</b>${c.temp}</div><div class="fact"><b>Engrais</b>${c.engrais}</div><div class="fact"><b>Animaux</b>${c.toxique ? "Toxique" : "Sans danger connu"}</div></div>
    <p>${c.conseil}</p>${ficheMore(c)}<button class="small" data-add="${c.id}">Ajouter à mon jardin</button></details>`).join("") : `<p class="note">Aucune fiche. Essayez l'onglet Identifier avec une photo.</p>`;
}
$("#catFilter").innerHTML = `<option value="">Toutes (${CATALOG.length - 1})</option>` + Object.entries(CATS).map(([k, l]) => `<option value="${k}">${l} (${CATALOG.filter(c => c.cat === k).length})</option>`).join("");
$("#search").oninput = () => renderCatalog(false); $("#catFilter").onchange = () => renderCatalog(false);
$("#catalog").addEventListener("click", e => { const b = e.target.closest("[data-add]"); if (b) { show("jardin"); openAdd({ species: b.dataset.add }); } });
$("#calMonth").innerHTML = MONTHS.map((m, i) => `<option value="${i + 1}">${m[0].toUpperCase() + m.slice(1)}</option>`).join("");
$("#calMonth").value = new Date().getMonth() + 1;
function renderCal() {
  const pl = place(), real = +$("#calMonth").value, m = pl && pl.lat < 0 ? (real + 5) % 12 + 1 : real;
  $("#calOut").innerHTML = Object.entries(CATS).map(([k, l]) => { const xs = CALENDAR.filter(x => x.cat === k && x.mois.includes(m)); return xs.length ? `<p style="margin:10px 0 4px"><b>${l}</b></p><ul>${xs.map(x => `<li>${x.txt}</li>`).join("")}</ul>` : ""; }).join("");
}
$("#calMonth").onchange = renderCal;
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
$("#gmKey").value = store.get("verdure.geminiKey", "");
$("#gmSave").onclick = () => { const k = $("#gmKey").value.replace(/[\s"'«»]/g, ""); $("#gmKey").value = k; store.set("verdure.geminiKey", k); toast(k ? "Clé Gemini enregistrée sur ce téléphone" : "Clé Gemini retirée"); };
function renderPlace() { const pl = place(); if (pl) $("#placeState").textContent = `Météo de ${pl.name}${weather ? ` : ${Math.round(weather.temp)} °C, humidité ${weather.hum} %` : ""}. Changez de ville ci-dessous si besoin.`; }
async function setPlace(pl) { store.set("verdure.place", pl); await loadWeather(true); renderPlace(); render(); renderCal(); toast(`Météo : ${pl.name}`); }
$("#placeFind").onclick = async () => {
  const q = $("#placeName").value.trim(); if (!q) return;
  try {
    const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=fr`)).json(), g = j.results?.[0];
    if (!g) return toast("Ville introuvable");
    setPlace({ name: g.name + (g.admin1 ? ", " + g.admin1 : ""), lat: +g.latitude.toFixed(3), lon: +g.longitude.toFixed(3) });
  } catch { toast("Recherche impossible sans connexion"); }
};
$("#placeName").onkeydown = e => { if (e.key === "Enter") $("#placeFind").click(); };
$("#placeGps").onclick = () => {
  if (!navigator.geolocation) return toast("Position non disponible");
  navigator.geolocation.getCurrentPosition(pos => setPlace({ name: "Ma position", lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2) }),
    () => toast("Position refusée : tapez plutôt votre ville"), { timeout: 10000 });
};
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
document.addEventListener("visibilitychange", () => { if (!document.hidden) { render(); loadWeather().then(render); } });
render(); renderCatalog(false); renderLight(); renderDx(); renderCal(); renderPlace();
loadWeather().then(() => { render(); renderPlace(); });
