// Page web d'un lien de comptes partagés (GET /s/:token) : tout est dessiné
// dans le navigateur à partir de GET /s/:token/data. Aucune bibliothèque
// externe ; les textes saisis sont toujours posés avec textContent.
// Couleurs de Passerelle : bleu nuit, cartes #0F1426, dégradé cyan → violet.

export function renderSplitPage(token: string | null): string {
  if (!token) {
    return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Lien expiré · Passerelle</title><body style="background:#070912;color:#E8F4FF;font-family:system-ui,sans-serif;padding:40px 16px;text-align:center"><p style="font-size:18px">Ce lien n'est plus valable.</p><p style="color:#9AA7C7">Demande un nouveau lien à la personne qui t'a invité.</p></body></html>`;
  }
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#070912">
<title>Comptes partagés · Passerelle</title>
<style>
  :root { --bg:#070912; --card:#0F1426; --line:#1E2740; --text:#E8F4FF; --muted:#9AA7C7; --faint:#6F7C9E; --cyan:#22E5FF; --violet:#9B5CFF; --green:#3DDC97; --red:#FF6B7A; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; font-size:16px; line-height:1.4; }
  main { max-width:560px; margin:0 auto; padding:16px 16px 80px; }
  h1 { font-size:22px; margin:8px 0 2px; }
  h2 { font-size:17px; margin:24px 0 8px; }
  .muted { color:var(--muted); } .faint { color:var(--faint); font-size:13px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:14px 16px; margin-bottom:8px; }
  .hero { text-align:center; padding:20px 16px; }
  .big { font-size:30px; font-weight:700; margin:4px 0; }
  .plus { color:var(--green); } .minus { color:var(--red); }
  .row { display:flex; align-items:center; gap:12px; }
  .row .grow { flex:1; min-width:0; }
  .amount { font-weight:700; white-space:nowrap; }
  .title { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  button, .btn { font:inherit; border:0; border-radius:14px; padding:12px 16px; cursor:pointer; color:var(--text); background:var(--line); min-height:44px; }
  .primary { background:linear-gradient(90deg,var(--cyan),#3FB8FF,var(--violet)); color:#070912; font-weight:700; width:100%; }
  .ghost { background:transparent; color:var(--cyan); padding:8px; }
  .danger { background:transparent; color:var(--red); border:1px solid var(--red); width:100%; }
  label { display:block; color:var(--muted); font-size:14px; margin:14px 0 6px; }
  input[type=text], input[type=date], input[inputmode] { width:100%; font:inherit; color:var(--text); background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px; min-height:44px; }
  input:focus { outline:2px solid var(--cyan); border-color:transparent; }
  .chips { display:flex; flex-wrap:wrap; gap:8px; }
  .chip { background:var(--card); border:1px solid var(--line); border-radius:999px; padding:8px 14px; min-height:40px; }
  .chip[aria-pressed=true] { background:var(--cyan); color:#070912; border-color:var(--cyan); font-weight:600; }
  .check { display:flex; align-items:center; gap:10px; padding:8px 0; }
  .check input { width:22px; height:22px; accent-color:var(--cyan); }
  .error { color:var(--red); font-size:14px; margin-top:8px; min-height:1em; }
  .thumb { width:100%; max-height:260px; object-fit:cover; border-radius:12px; margin-top:8px; }
  dialog { background:var(--bg); color:var(--text); border:1px solid var(--line); border-radius:20px; width:min(560px,100vw - 24px); max-height:92vh; padding:16px; }
  dialog::backdrop { background:rgba(0,0,0,.6); }
  .tag { font-size:12px; color:var(--violet); }
  .visually-hidden { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  footer { text-align:center; color:var(--faint); font-size:12px; margin-top:32px; }
</style>
</head>
<body>
<main id="app" data-token="${token}"><p class="muted">Chargement…</p></main>
<dialog id="form" aria-labelledby="form-title">
  <form method="dialog" id="expense-form" novalidate>
    <div class="row"><h2 id="form-title" class="grow" style="margin:0">Nouvelle dépense</h2><button type="button" class="ghost" id="close" aria-label="Fermer">✕</button></div>
    <label for="f-amount">Montant (€)</label>
    <input id="f-amount" inputmode="decimal" autocomplete="off" placeholder="Ex. 42,50" required>
    <label for="f-title">Pour quoi ?</label>
    <input id="f-title" type="text" maxlength="80" placeholder="Ex. Courses, cantine, essence" required>
    <label>Payé par</label>
    <div class="chips" id="f-payer" role="radiogroup"></div>
    <label for="f-date">Date</label>
    <input id="f-date" type="date">
    <label>Pour qui ? <span class="faint" id="f-mode-hint"></span></label>
    <div id="f-people"></div>
    <label>Ticket (facultatif)</label>
    <input id="f-photo" type="file" accept="image/*" capture="environment" class="visually-hidden">
    <label for="f-photo" class="btn" style="display:inline-block;color:var(--text);margin:0" id="f-photo-label">📷 Prendre en photo</label>
    <img id="f-thumb" class="thumb" alt="Photo du ticket" hidden>
    <p class="error" id="f-error" role="alert"></p>
    <button type="submit" class="btn primary" id="f-save">Ajouter la dépense</button>
    <p style="margin-top:8px"><button type="button" class="danger" id="f-delete" hidden>Supprimer cette dépense</button></p>
  </form>
</dialog>
<script>
(function () {
  "use strict";
  var app = document.getElementById("app");
  var base = "/s/" + app.dataset.token;
  var state = null;
  var editing = null;

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === "text") n.textContent = attrs[k]; else if (k === "class") n.className = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function eur(c) { var s = c < 0 ? "-" : ""; c = Math.abs(c); return s + Math.floor(c / 100).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, "\\u202f") + "," + String(c % 100).padStart(2, "0") + "\\u00a0€"; }
  function parseAmount(s) { var n = Number(String(s).replace(/\\s/g, "").replace(",", ".")); return isFinite(n) && n > 0 ? Math.round(n * 100) : null; }
  function name(id) { var p = state.group.participants.find(function (x) { return x.id === id; }); return p ? p.name : "?"; }
  function day(d) { var m = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."]; var p = d.split("-"); return Number(p[2]) + " " + m[Number(p[1]) - 1]; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function api(method, path, body) {
    return fetch(base + path, { method: method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Ça n'a pas marché. Réessaie."); return j; }); });
  }

  function render() {
    var g = state.group, me = state.me;
    var mine = (g.balances.find(function (b) { return b.participantId === me; }) || { cents: 0 }).cents;
    app.textContent = "";
    app.appendChild(el("p", { class: "faint", text: "Comptes partagés · Passerelle" }));
    app.appendChild(el("h1", { text: g.emoji + " " + g.name }));
    app.appendChild(el("p", { class: "muted", text: "Bonjour " + name(me) + " !" }));
    app.appendChild(el("div", { class: "card hero" }, [
      el("div", { class: "muted", text: "Dépensé ensemble" }),
      el("div", { class: "big", text: eur(g.spentCents) }),
      el("div", { class: mine > 0 ? "plus" : mine < 0 ? "minus" : "muted", text: mine > 0 ? "On te doit " + eur(mine) : mine < 0 ? "Tu dois " + eur(-mine) : "Tu es à l'équilibre" })
    ]));
    var add = el("button", { class: "btn primary", type: "button", text: "Ajouter une dépense" });
    add.addEventListener("click", function () { openForm(null); });
    app.appendChild(add);

    app.appendChild(el("h2", { text: "Qui doit combien à qui" }));
    if (!g.transfers.length) app.appendChild(el("div", { class: "card muted", text: "✅ Tout le monde est à l'équilibre." }));
    g.transfers.forEach(function (t) {
      app.appendChild(el("div", { class: "card", text: name(t.fromId) + " doit " + eur(t.amountCents) + " à " + name(t.toId) }));
    });

    app.appendChild(el("h2", { text: "Dépenses (" + g.expenseCount + ")" }));
    (g.expenses || []).forEach(function (e) {
      var transfer = e.kind === "transfer";
      var share = e.shares.find(function (s) { return s.participantId === me; });
      var sub = day(e.date) + " · " + (transfer ? "remboursement" : "payé par " + name(e.paidById)) + (!transfer && share ? " · ta part " + eur(share.amountCents) : "");
      var card = el("div", { class: "card row" }, [
        el("div", { class: "grow" }, [
          el("div", { class: "title", text: (transfer ? "💸 " : "") + e.title + (e.photoUrl ? "  📎" : "") }),
          el("div", { class: "faint", text: sub }),
          e.addedById === me ? el("div", { class: "tag", text: "Ajoutée par toi · touche pour modifier" }) : null
        ]),
        el("div", { class: "amount", text: eur(e.amountCents) })
      ]);
      if (e.addedById === me) { card.setAttribute("role", "button"); card.tabIndex = 0; card.style.cursor = "pointer"; card.addEventListener("click", function () { openForm(e); }); }
      else if (e.photoUrl) { card.style.cursor = "pointer"; card.addEventListener("click", function () { window.open(e.photoUrl, "_blank", "noopener"); }); }
      app.appendChild(card);
    });
    app.appendChild(el("footer", { text: "Lien personnel de " + name(me) + ". Ne le partage pas." }));
  }

  // ── Formulaire ──
  var dlg = document.getElementById("form");
  var f = { amount: byId("f-amount"), title: byId("f-title"), payer: byId("f-payer"), date: byId("f-date"), people: byId("f-people"), hint: byId("f-mode-hint"), photo: byId("f-photo"), thumb: byId("f-thumb"), error: byId("f-error"), save: byId("f-save"), del: byId("f-delete") };
  function byId(id) { return document.getElementById(id); }
  var payer = null, mode = "equal", values = {};

  function openForm(e) {
    editing = e;
    var g = state.group;
    byId("form-title").textContent = e ? "Modifier la dépense" : "Nouvelle dépense";
    f.save.textContent = e ? "Enregistrer" : "Ajouter la dépense";
    f.del.hidden = !e;
    f.amount.value = e ? (e.amountCents / 100).toFixed(2).replace(".", ",") : "";
    f.title.value = e ? e.title : "";
    f.date.value = e ? e.date : today();
    f.photo.value = ""; byId("f-photo-label").textContent = e && e.photoUrl ? "📷 Changer la photo" : "📷 Prendre en photo"; f.thumb.hidden = !(e && e.photoUrl); if (e && e.photoUrl) f.thumb.src = e.photoUrl;
    f.error.textContent = "";
    payer = e ? e.paidById : state.me;
    // Le partage : celui de la dépense, sinon celui retenu par le groupe, sinon à parts égales entre tous.
    if (e) { mode = e.mode; values = {}; e.shares.forEach(function (s) { values[s.participantId] = s.value; }); }
    else if (g.defaultSplit) { mode = g.defaultSplit.mode; values = Object.assign({}, g.defaultSplit.values); }
    else { mode = "equal"; values = {}; g.participants.forEach(function (p) { values[p.id] = 1; }); }
    f.hint.textContent = mode === "equal" ? "(à parts égales)" : "(comme d'habitude dans ce groupe)";
    drawPayer(); drawPeople();
    dlg.showModal();
    setTimeout(function () { f.amount.focus(); }, 50);
  }
  function drawPayer() {
    f.payer.textContent = "";
    state.group.participants.forEach(function (p) {
      var b = el("button", { type: "button", class: "chip", role: "radio", "aria-pressed": String(payer === p.id), "aria-checked": String(payer === p.id), text: p.name });
      b.addEventListener("click", function () { payer = p.id; drawPayer(); });
      f.payer.appendChild(b);
    });
  }
  function drawPeople() {
    f.people.textContent = "";
    state.group.participants.forEach(function (p) {
      var id = "pp-" + p.id;
      var box = el("input", { type: "checkbox", id: id });
      box.checked = p.id in values;
      box.addEventListener("change", function () { if (box.checked) values[p.id] = mode === "equal" ? 1 : (values[p.id] || 0); else delete values[p.id]; });
      f.people.appendChild(el("div", { class: "check" }, [box, el("label", { for: id, text: p.name, style: "margin:0;color:var(--text)" })]));
    });
  }
  f.photo.addEventListener("change", function () { var file = f.photo.files[0]; if (file) { f.thumb.src = URL.createObjectURL(file); f.thumb.hidden = false; byId("f-photo-label").textContent = "📷 Changer la photo"; } });
  byId("close").addEventListener("click", function () { dlg.close(); });

  byId("expense-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var cents = parseAmount(f.amount.value);
    var title = f.title.value.trim();
    var shares = Object.keys(values).map(function (pid) { return { participantId: pid, value: mode === "equal" ? 1 : values[pid] }; });
    if (!cents) { f.error.textContent = "Indique un montant."; return; }
    if (!title) { f.error.textContent = "Indique pour quoi."; return; }
    if (!shares.length) { f.error.textContent = "Choisis au moins une personne."; return; }
    // Une personne décochée ou ajoutée change un partage en % ou en montants : on repasse à parts égales.
    if (mode !== "equal" && editing === null && state.group.defaultSplit) {
      var same = Object.keys(state.group.defaultSplit.values).sort().join() === Object.keys(values).sort().join();
      if (!same) { mode = "equal"; shares = shares.map(function (s) { return { participantId: s.participantId, value: 1 }; }); }
    }
    var file = f.photo.files[0] || null;
    var body = { title: title, amountCents: cents, paidById: payer, date: f.date.value || today(), mode: mode, shares: shares, photo: file ? { mimeType: file.type || "image/jpeg", size: file.size } : null };
    f.save.disabled = true; f.error.textContent = "";
    api(editing ? "PUT" : "POST", "/expenses" + (editing ? "/" + editing.id : ""), body)
      .then(function (r) {
        if (file && r.upload) return fetch(r.upload.url, { method: r.upload.method, headers: r.upload.headers, body: file }).then(function () { return api("GET", "/data"); });
        return r;
      })
      .then(function (r) { state = r; render(); dlg.close(); })
      .catch(function (e) { f.error.textContent = e.message; })
      .then(function () { f.save.disabled = false; });
  });
  f.del.addEventListener("click", function () {
    if (!editing || !confirm("Supprimer « " + editing.title + " » ?")) return;
    api("DELETE", "/expenses/" + editing.id).then(function (r) { state = r; render(); dlg.close(); }).catch(function (e) { f.error.textContent = e.message; });
  });

  function load() {
    api("GET", "/data").then(function (r) { state = r; render(); }).catch(function (e) { app.textContent = ""; app.appendChild(el("p", { class: "muted", text: e.message })); });
  }
  load();
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !dlg.open) load(); });
})();
</script>
</body>
</html>`;
}
