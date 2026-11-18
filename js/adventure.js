/* Adventure frame: character, journey path through regions, rivals, placement games,
   journey log. Shares one rating/XP/badge store with Train (window.Progress). Original art, no real players. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const P = () => window.Progress.get();
  const rating = () => P().rating.estimate;

  // ---- regions & rivals --------------------------------------------------------
  const REGIONS = [
    { id: "village", unit: 0, name: "The Village", topic: "Basics", band: [0, 699], hue: "#c9a76a", ink: "#f0e2c4", ground: "#2c2618",
      arrive: "Everyone starts here. The pieces still surprise you, and that's useful." },
    { id: "cliffs", unit: 1, name: "Mating Grounds", topic: "Checkmates", band: [700, 899], hue: "#b8735a", ink: "#f0d2c4", ground: "#2a1c16",
      arrive: "Kings die on open lines. These patterns should start to feel obvious." },
    { id: "tower", unit: 2, name: "The Watchtower", topic: "Safety", band: [900, 1099], hue: "#7d8fa3", ink: "#d5e0ea", ground: "#1a222a",
      arrive: "Loose pieces lose games. See the threat before you invent a plan." },
    { id: "forest", unit: 3, name: "Tactics Forest", topic: "Tactics", band: [1100, 1299], hue: "#5f8a6a", ink: "#d4e8d8", ground: "#152018",
      arrive: "Forks and pins hide in quiet moves. Look twice before you take." },
    { id: "peaks", unit: 5, name: "Endgame Peaks", topic: "Endgames", band: [1300, 9999], hue: "#9aa7b8", ink: "#e4ebf2", ground: "#1b2228",
      arrive: "Fewer pieces, less cover. The last pawn decides more than it should." },
    // 1.6.1: the Citadel follows the Peaks (no entry band; opens early for players near 1800+).
    { id: "citadel", unit: 6, name: "The Citadel", topic: "Middlegame", follow: true, opensAt: 1800, hue: "#a08a5a", ink: "#efe3c8", ground: "#241e14",
      arrive: "Pawn structures set the plan. Play the square, not the pretty piece." },
    // 1.6.1: the Crossroads is an open side road: any rating, any time, never blocks the main path.
    { id: "crossroads", unit: 4, name: "Opening Crossroads", topic: "Openings", open: true, hue: "#8a7a9a", ink: "#e6ddee", ground: "#1e1a24",
      arrive: "A side road, any time. The first twelve moves are a map, not a script." }
  ];
  // Fictional rivals built on the CC0-book personas. Strength scales with your rating.
  const RIVALS = {
    village: { id: "vane", name: "Tess Vane", title: "The Opportunist", persona: "wing-pawn-opener", color: "#c9a76a",
      line: "Leave something loose and I'll take it. Nothing personal. Mostly.",
      rematch: "You're heavier than last time. I'll still take whatever you leave loose." },
    cliffs: { id: "ember", name: "Ember", title: "The Attacker", persona: "gambiteer", color: "#c4623f",
      line: "I bring pawns as gifts. The bill comes later, aimed at your king.",
      rematch: "You've seen the gift. Let's see if you still open the wrapping." },
    tower: { id: "bastion", name: "Bastion", title: "The Wall", persona: "solid-defender", color: "#6f8296",
      line: "I don't attack. I wait. Most people get bored first.",
      rematch: "You didn't get bored. Good. The wall is taller now." },
    forest: { id: "quill", name: "Quill", title: "The Trickster", persona: "trap-setter", color: "#5f8a6a",
      line: "Every move I make looks harmless. That's the point.",
      rematch: "You stopped falling for the first trick. I have others." },
    peaks: { id: "gale", name: "Old Gale", title: "The Grinder", persona: "fianchetto-grinder", color: "#8c97a6",
      line: "Trade down with me if you like. I've been winning endgames since before you castled.",
      rematch: "You traded down once. I still like the ending more than you do." },
    crossroads: { id: "marlow", name: "Marlow", title: "The Theorist", persona: "solid-defender", color: "#8a7a9a",
      line: "I know the first twelve moves of everything. Move thirteen is where we find out about you.",
      rematch: "You survived move thirteen. I've revised the first twelve." },
    citadel: { id: "vesper", name: "Vesper", title: "The Strategist", persona: "fianchetto-grinder", color: "#a08a5a",
      line: "I won't hang a thing. I'll just take your squares, one at a time.",
      rematch: "You kept your pieces. Now keep your squares." }
  };
  function regionFor(r) { const x = REGIONS.filter((g) => g.band && !g.soon).find((g) => r >= g.band[0] && r <= g.band[1]); return x || REGIONS[0]; }

  // ---- journey nodes -------------------------------------------------------------
  function regionLessons(g) { const u = window.Lessons && window.Lessons.units().find((x) => x.id === g.unit); return u ? u.lessons : []; }
  function buildPath() {
    const out = [];
    // Main road first, then open side roads, so path order never depends on the side roads.
    for (const g of REGIONS.filter((x) => !x.open).concat(REGIONS.filter((x) => x.open))) {
      if (g.soon) continue;
      const ls = regionLessons(g);
      const reg = ls.filter((l) => !l.boss), boss = ls.find((l) => l.boss);
      reg.forEach((l) => out.push({ id: l.id, kind: "lesson", region: g.id, lesson: l.id, title: l.title, tier: l.tier || 0 }));
      out.push({ id: "rival-" + g.id, kind: "rival", region: g.id, title: RIVALS[g.id].name + ", " + RIVALS[g.id].title });
      if (g.id === "forest") out.push({ id: "rush-forest", kind: "rush", region: g.id, title: "Rush: 3 minutes" });
      if (boss) out.push({ id: boss.id, kind: "boss", region: g.id, lesson: boss.id, title: boss.title });
    }
    return out;
  }
  function start() {
    const r = rating(), g = regionFor(r);
    const path = buildPath();
    const node = path.find((n) => n.region === g.id && !(P().nodes[n.id] && P().nodes[n.id].complete) && !(n.tier > r)) || path.find((n) => n.region === g.id);
    return { rating: r, region: g.id, regionName: g.name, unit: g.unit, node: node ? node.id : null, id: node ? node.id : null, title: node ? node.title : g.name };
  }
  const regionById = (id) => REGIONS.find((g) => g.id === id);
  function nodes() {
    const st = start(), r = st.rating, path = buildPath();
    const main = path.filter((n) => !regionById(n.region).open), side = path.filter((n) => regionById(n.region).open);
    const entryIdx = main.findIndex((n) => n.region === st.region);
    let prevDone = true, lastRegion = null;
    const walk = (list) => list.map((n) => {
      const g = regionById(n.region);
      // A side road starts unlocked; the Citadel opens early for strong players.
      if (n.region !== lastRegion) { if (g.open || (g.opensAt && r >= g.opensAt)) prevDone = true; lastRegion = n.region; }
      const complete = !!(P().nodes[n.id] && P().nodes[n.id].complete);
      const tierLocked = n.tier > r;
      const locked = tierLocked || !prevDone;
      if (!tierLocked) prevDone = complete;
      return Object.assign({}, n, { complete, locked, tierLocked, side: !!g.open });
    });
    return walk(main.slice(Math.max(0, entryIdx))).concat(walk(side)).map((n, i) => Object.assign(n, { index: i }));
  }
  function nodeForLesson(lessonId) { const n = buildPath().find((x) => x.lesson === lessonId); return n ? Object.assign({}, n, { complete: !!(P().nodes[n.id] && P().nodes[n.id].complete) }) : null; }
  function completeNode(id) { P().nodes[id] = { complete: true, at: Date.now() }; window.Progress.save(); return true; }
  function completeFromLesson(lessonId) { const n = nodeForLesson(lessonId); if (n) completeNode(n.id); return n; }
  function startNode(id) {
    const n = trailNodes().find((x) => x.id === id) || nodes().find((x) => x.id === id);
    if (!n || n.locked) return false;
    if (window.UI) window.UI._lessonBack = "adventure";
    if (n.kind === "rival") { showRivalIntro(n.region); return true; }
    if (n.kind === "rush") { if (window.Rush) window.Rush.open(); return true; }
    return window.Lessons.start(n.lesson, { from: "adventure", node: n.id });
  }
  /** Named next step for the end of any session. */
  function nextStep(afterLessonId) {
    const list = nodes();
    const at = afterLessonId ? list.findIndex((n) => n.lesson === afterLessonId) : -1;
    const n = list.slice(at + 1).find((x) => !x.complete && !x.tierLocked && !x.locked) || list.find((x) => !x.complete && !x.tierLocked && !x.locked);
    if (!n) return { label: "Rush round", minutes: 3, go: () => window.Rush && window.Rush.open() };
    const g = REGIONS.find((x) => x.id === n.region);
    const mins = n.kind === "rival" ? 8 : n.kind === "rush" ? 3 : window.Lessons.minutes(window.Lessons.lesson(n.lesson) || {});
    const label = n.kind === "rival" ? g.name.replace(/^The /, "") + " rival" : n.kind === "boss" ? g.name.replace(/^The /, "") + " test" : n.title;
    return { label, minutes: mins, node: n.id, go: () => { if (window.UI) window.UI.showTab("adventure"); startNode(n.id); } };
  }

  // ---- story log, rematches, full trail (passed lands stay on the map) -----------------
  const MAIN_ORDER = () => REGIONS.filter((g) => !g.open && !g.soon).map((g) => g.id);
  function storyList() { if (!P().story) P().story = []; return P().story; }
  function logEvent(ev) {
    const row = Object.assign({ at: Date.now(), rating: rating() }, ev);
    const list = storyList();
    const last = list[list.length - 1];
    if (last && last.kind === row.kind && last.region === row.region && last.rival === row.rival && last.line === row.line) return last;
    list.push(row);
    window.Progress.save();
    return row;
  }
  function markArrival(regionId) {
    const a = P().arrivals || (P().arrivals = {});
    if (a[regionId]) return false;
    a[regionId] = Date.now();
    const g = regionById(regionId);
    if (g) logEvent({ kind: "region", region: regionId, title: g.name, line: "You reached " + g.name.replace(/^The /, "") + ". " + g.arrive });
    window.Progress.save();
    return true;
  }
  function rematchReady(regionId) {
    const rv = RIVALS[regionId]; if (!rv) return false;
    const rec = P().rivals[rv.id] || {};
    const beaten = (rec.wins || 0) + (rec.draws || 0) > 0 || !!(P().nodes["rival-" + regionId] && P().nodes["rival-" + regionId].complete);
    if (!beaten) return false;
    if (rec.rematchReady) return true;
    const grew = rec.lastRating != null && rating() >= rec.lastRating + 100;
    const order = MAIN_ORDER();
    const mine = order.indexOf(start().region);
    const theirs = order.indexOf(regionId);
    const later = (theirs >= 0 && mine > theirs) || Object.keys(P().arrivals || {}).some((id) => order.indexOf(id) > theirs && theirs >= 0);
    return !!(grew || later);
  }
  function unlockRematch(regionId) {
    const rv = RIVALS[regionId]; if (!rv) return;
    const rec = P().rivals[rv.id]; if (!rec) return;
    if (!rec.rematchReady && rematchReady(regionId)) { rec.rematchReady = true; window.Progress.save(); }
  }
  /** Active path (from the entry region) plus earlier passed lands, so the map is a road you have traveled. */
  function trailNodes() {
    const st = start(), path = buildPath();
    const main = path.filter((n) => !regionById(n.region).open);
    const entryIdx = main.findIndex((n) => n.region === st.region);
    const earlier = main.slice(0, Math.max(0, entryIdx)).map((n) => {
      const complete = !!(P().nodes[n.id] && P().nodes[n.id].complete);
      return Object.assign({}, n, { complete, locked: false, tierLocked: false, passed: true, side: false });
    });
    return earlier.concat(nodes()).map((n, i) => Object.assign({}, n, { index: i }));
  }
  function maybeCrossRegion(regionId) {
    const list = trailNodes().filter((n) => n.region === regionId && !n.side);
    if (!list.length) return;
    if (list.every((n) => n.complete || n.kind === "rival" && rematchReady(regionId))) {
      const g = regionById(regionId);
      if (g && !(P().crossed || (P().crossed = {}))[regionId]) {
        P().crossed[regionId] = Date.now();
        logEvent({ kind: "crossed", region: regionId, title: g.name, line: "You crossed " + g.name.replace(/^The /, "") + ". The road ahead is still open." });
      }
    }
  }
  const _completeNode = completeNode;
  completeNode = function (id) {
    const ok = _completeNode(id);
    const n = buildPath().find((x) => x.id === id);
    if (n && n.kind === "boss") {
      const g = regionById(n.region);
      logEvent({ kind: "boss", region: n.region, title: n.title, line: (g ? g.name.replace(/^The /, "") + " test cleared." : "Test cleared.") + " The next one will scale to your rating." });
    }
    if (n) maybeCrossRegion(n.region);
    return ok;
  };

  // ---- character -------------------------------------------------------------------
  const PARTS = {
    tone: ["#e8c4a0", "#d1a07a", "#a8714e", "#7a4e33", "#4e3324"],
    hair: ["short", "crop", "long", "bun", "cap", "beanie"],
    outfit: ["#2f4858", "#5b3a4a", "#3c5a3f", "#6b5a3a", "#3a3f5c"],
    acc: ["none", "glasses", "scarf", "earring", "headphones"]
  };
  function getCharacter() { return P().character; }
  function setCharacter(c) { P().character = Object.assign({ tone: 1, hair: 0, outfit: 0, acc: 0, name: "Player" }, P().character || {}, c); window.Progress.save(); return P().character; }
  /** Your character: the on-device photo if you set one, otherwise the drawn avatar. */
  function avatarSVG(c, size, opts) {
    if (!(opts && opts.drawn) && window.AvatarPhoto && window.AvatarPhoto.get()) return window.AvatarPhoto.img(size || 96);
    c = c || { tone: 1, hair: 0, outfit: 0, acc: 0 };
    const tone = PARTS.tone[c.tone] || PARTS.tone[1], out = PARTS.outfit[c.outfit] || PARTS.outfit[0], hair = PARTS.hair[c.hair] || "short", acc = PARTS.acc[c.acc] || "none";
    const hc = "#2a2622";
    const hairSvg = {
      short: `<path d="M30 34c0-12 9-19 20-19s20 7 20 19c-4-6-11-8-20-8s-16 2-20 8z" fill="${hc}"/>`,
      crop: `<path d="M31 31c2-10 10-15 19-15s17 5 19 15c-6-3-12-4-19-4s-13 1-19 4z" fill="${hc}"/>`,
      long: `<path d="M28 36c0-14 10-21 22-21s22 7 22 21v22c-3-2-5-6-6-12V34c-4-5-10-7-16-7s-12 2-16 7v12c-1 6-3 10-6 12z" fill="${hc}"/>`,
      bun: `<circle cx="50" cy="12" r="7" fill="${hc}"/><path d="M30 34c0-12 9-19 20-19s20 7 20 19c-4-6-11-8-20-8s-16 2-20 8z" fill="${hc}"/>`,
      cap: `<path d="M28 30c2-11 11-16 22-16s20 5 22 16z" fill="#1f2a33"/><rect x="48" y="27" width="30" height="5" rx="2.5" fill="#1f2a33"/>`,
      beanie: `<path d="M29 32c0-13 9-19 21-19s21 6 21 19z" fill="#6b3a3a"/><rect x="28" y="29" width="44" height="6" rx="3" fill="#552d2d"/>`
    }[hair];
    const accSvg = {
      none: "",
      glasses: `<g fill="none" stroke="#1d1d1d" stroke-width="2"><circle cx="42" cy="40" r="5"/><circle cx="58" cy="40" r="5"/><path d="M47 40h6"/></g>`,
      scarf: `<path d="M34 60h32l-3 8H37z" fill="#b5543f"/><path d="M56 64l5 14h-6l-3-12z" fill="#9c4433"/>`,
      earring: `<circle cx="30.5" cy="47" r="1.8" fill="#d9b44a"/>`,
      headphones: `<path d="M27 42c0-15 10-24 23-24s23 9 23 24" fill="none" stroke="#222" stroke-width="3"/><rect x="24" y="38" width="7" height="11" rx="3" fill="#222"/><rect x="69" y="38" width="7" height="11" rx="3" fill="#222"/>`
    }[acc];
    return `<svg class="avatar" viewBox="0 0 100 100" width="${size || 96}" height="${size || 96}" role="img" aria-label="Your character"><circle cx="50" cy="50" r="48" fill="#1c2a33"/><path d="M18 96c3-20 16-30 32-30s29 10 32 30z" fill="${out}"/><rect x="44" y="55" width="12" height="10" fill="${tone}"/><ellipse cx="50" cy="40" rx="19" ry="21" fill="${tone}"/>${hairSvg}<circle cx="43" cy="41" r="1.8" fill="#222"/><circle cx="57" cy="41" r="1.8" fill="#222"/><path d="M45 50q5 3 10 0" stroke="#5a3a2a" stroke-width="1.6" fill="none"/>${accSvg}</svg>`;
  }
  function openCreate(edit) {
    const inl = document.getElementById("char-edit-fields"); if (inl) inl.innerHTML = "";
    const sheet = document.getElementById("settings-sheet"); if (sheet) sheet.hidden = true;
    const ov = document.createElement("div");
    ov.className = "overlay char-overlay";
    ov.setAttribute("data-testid", "character-create");
    const c = Object.assign({ tone: 1, hair: 0, outfit: 0, acc: 0, name: "" }, getCharacter() || {});
    const row = (key, label, n) => `<div class="cc-row"><span class="cc-label">${label}</span><div class="cc-opts">${Array.from({ length: n }, (_, i) => `<button type="button" class="cc-opt${c[key] === i ? " on" : ""}" data-part="${key}" data-i="${i}" data-testid="character-part" aria-label="${label} ${i + 1}">${key === "tone" || key === "outfit" ? `<i style="background:${PARTS[key][i]}"></i>` : esc(PARTS[key][i])}</button>`).join("")}</div></div>`;
    ov.innerHTML = `<div class="cc-card"><div class="cc-body"><h2>${edit ? "Edit your character" : "Who's playing?"}</h2><p class="muted">Looks only. Stays on this device.</p>
      <div class="cc-preview" id="cc-preview">${avatarSVG(c, 112)}</div>
      <div class="cc-photo" id="cc-photo"></div>
      <input id="character-name" data-testid="character-name" maxlength="18" placeholder="Your name" value="${esc(c.name)}" autocomplete="off">
      ${row("tone", "Skin", 5)}${row("hair", "Hair", 6)}${row("outfit", "Outfit", 5)}${row("acc", "Extra", 5)}
      </div><button type="button" class="primary" data-testid="character-save" id="cc-save">${edit ? "Save" : "Start"}</button></div>`;
    document.body.appendChild(ov);
    // Optional photo, kept on this device only. The drawn avatar below stays as the fallback.
    const photoRow = () => {
      const has = window.AvatarPhoto && window.AvatarPhoto.get();
      $("#cc-photo", ov).innerHTML = `<label class="ghost tiny cc-upload" data-testid="avatar-photo-upload">${has ? "Change photo" : "Use a photo"}<input type="file" accept="image/*" id="cc-file" hidden></label>${has ? `<button type="button" class="ghost tiny" id="cc-photo-x" data-testid="avatar-photo-remove">Remove photo</button>` : ""}<span class="muted cc-photo-note">Stays on this phone.</span>`;
      $("#cc-file", ov).addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        window.AvatarPhoto.crop(f, (url, err) => {
          if (url) window.AvatarPhoto.set(url);
          else if (err) $("#cc-photo", ov).insertAdjacentHTML("beforeend", `<p class="muted">${esc(err)}</p>`);
          $("#cc-preview", ov).innerHTML = avatarSVG(c, 112); photoRow();
        });
      });
      const x = $("#cc-photo-x", ov);
      if (x) x.addEventListener("click", () => { window.AvatarPhoto.clear(); $("#cc-preview", ov).innerHTML = avatarSVG(c, 112); photoRow(); });
    };
    if (window.AvatarPhoto) photoRow();
    ov.querySelectorAll("[data-part]").forEach((b) => b.addEventListener("click", () => {
      c[b.getAttribute("data-part")] = +b.getAttribute("data-i");
      ov.querySelectorAll(`[data-part="${b.getAttribute("data-part")}"]`).forEach((x) => x.classList.toggle("on", x === b));
      $("#cc-preview", ov).innerHTML = avatarSVG(c, 112);
    }));
    $("#cc-save", ov).addEventListener("click", () => {
      c.name = ($("#character-name", ov).value || "").trim() || "Player";
      setCharacter(c);
      ov.remove();
      if (window.UI && window.UI.refresh) window.UI.refresh();
    });
  }
  function ensureCharacter() { if (!getCharacter() && !document.querySelector("[data-testid=character-create]")) openCreate(false); }

  // ---- adventure view -------------------------------------------------------------------
  function view() {
    let v = document.getElementById("adventure-view");
    if (!v) { v = document.createElement("section"); v.id = "adventure-view"; v.hidden = true; document.querySelector(".main").appendChild(v); }
    return v;
  }
  function render(v) {
    v = v || view();
    if (!window.Lessons.data()) { v.innerHTML = "<p class=\"muted\">Loading the map…</p>"; window.Lessons.load().then(() => render(v)); return; }
    const st = start(), list = trailNodes(), c = getCharacter();
    const lv = window.Progress.levelOf(P().xp);
    const hereId = st.node;
    let html = `<div class="adv" data-testid="journey-map">
      <div class="adv-head">${avatarSVG(c, 52)}<div><b>${esc((c && c.name) || "Player")}</b><span class="muted"> · Level ${lv.level} · ${esc(window.Progress.ratingLabel())}</span>
      <div class="xpbar"><i style="width:${Math.round(lv.into / lv.need * 100)}%"></i></div></div>
      <button type="button" class="ghost tiny" id="adv-log" data-testid="journey-log-open">Journey log</button></div>`;
    const nx = nextStep();
    if (nx) html += `<button type="button" class="primary adv-next" id="adv-next" data-testid="session-next-step">Next: ${esc(nx.label)}, ${nx.minutes} min</button>`;
    html += `<div class="adv-path" id="adv-path"><svg class="adv-trail" id="adv-trail" aria-hidden="true"></svg>`;
    let lastRegion = null, k = 0;
    const closeLand = () => { if (lastRegion) html += `</section>`; };
    for (const n of list) {
      if (n.region !== lastRegion) {
        closeLand();
        const g = REGIONS.find((x) => x.id === n.region);
        const at = g.id === st.region;
        const fresh = (at || g.open) ? markArrival(g.id) : false;
        html += `<section class="adv-land${g.open ? " side" : ""}${n.passed ? " passed-land" : ""}${at ? " here-land" : ""}${fresh ? " fresh" : ""}" data-region="${g.id}" style="--hue:${g.hue};--land:${g.ground};--ink:${g.ink}">
          ${landArt(g)}
          <header class="adv-region${g.open ? " side" : ""}">
            <div class="adv-rtext"><span class="adv-rname">${esc(g.name)}</span><span class="muted">${esc(g.topic)}${g.open ? " · Side road, any time" : n.passed ? " · Passed" : at ? " · You are here" : ""}</span></div>
          </header>
          <p class="adv-arrive" data-testid="region-arrival" data-region="${g.id}">${esc(g.arrive)}</p>`;
        lastRegion = n.region; k = 0;
      }
      const isHere = n.id === hereId;
      const ready = n.kind === "rival" && rematchReady(n.region);
      const icon = { lesson: "●", boss: "♛", rival: "⚔", rush: "⚡" }[n.kind];
      const zz = [0, 1, 2, 1][k++ % 4];
      const rematchBtn = (n.kind === "rival" && n.complete && ready)
        ? `<button type="button" class="jn-rematch" data-testid="rival-rematch" data-rival="${esc(RIVALS[n.region].id)}" data-region="${esc(n.region)}">Rematch</button>`
        : (n.kind === "rival" && n.complete && !ready) ? `<span class="jn-meta">Rematch after you grow</span>` : "";
      html += `<div class="jn-wrap zz${zz}" data-testid="journey-path-node" data-node="${esc(n.id)}" data-region="${esc(n.region)}" data-kind="${n.kind}" data-locked="${n.locked}" data-complete="${n.complete}">
        <button type="button" class="jnode ${n.kind}${n.complete ? " complete" : ""}${n.locked ? " locked" : ""}${isHere ? " here" : ""}${n.passed ? " passed" : ""}" ${n.passed ? "" : `data-testid="journey-node"`} data-node="${esc(n.id)}" data-index="${n.index}" data-kind="${n.kind}" data-region="${esc(n.region)}" data-locked="${n.locked}" data-complete="${n.complete}" ${n.lesson ? `data-lesson="${esc(n.lesson)}"` : ""} ${n.locked ? 'aria-disabled="true"' : ""}>
        <span class="jn-icon">${n.kind === "rival" && RIVALS[n.region] ? portrait(RIVALS[n.region], 32) : n.complete ? "✓" : icon}</span>${n.kind === "rival" && RIVALS[n.region] ? `<span class="jn-title"><span class="jn-name">${esc(RIVALS[n.region].name)}</span><span class="jn-role">${esc(RIVALS[n.region].title)}</span></span>` : `<span class="jn-title">${esc(n.title)}</span>`}
        ${n.tierLocked ? `<span class="jn-meta">Opens near ${n.tier}</span>` : ""}
        ${isHere ? `<span hidden data-testid="adventure-entry-node" data-node="${esc(n.id)}" data-unit="${st.unit}" data-title="${esc(n.title)}"></span>` : ""}
        </button>${rematchBtn}</div>`;
    }
    closeLand();
    html += `<div class="player-token" id="player-token" data-testid="player-token" data-node="${esc(hereId || "")}">${avatarSVG(c, 36)}</div>`;
    html += `</div></div>`;
    v.innerHTML = html;
    const startFrom = (id, locked) => {
      if (locked === "true") { return false; }
      startNode(id);
      return true;
    };
    v.querySelectorAll(".jnode").forEach((b) => b.addEventListener("click", () => {
      if (b.getAttribute("data-locked") === "true") { b.classList.add("shake"); setTimeout(() => b.classList.remove("shake"), 400); return; }
      startNode(b.getAttribute("data-node"));
    }));
    v.querySelectorAll("[data-testid=rival-rematch]").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      showRivalIntro(b.getAttribute("data-region"), { rematch: true });
    }));
    $("#adv-log", v).addEventListener("click", openLog);
    const nb = $("#adv-next", v); if (nb && nx) nb.addEventListener("click", () => nx.go());
    requestAnimationFrame(() => { drawTrail(v); placeToken(v, hereId); });
    const here = v.querySelector(".jnode.here"); if (here && here.scrollIntoView) setTimeout(() => here.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
  }
  /** Landscape silhouettes, original flat art, one look per region. */
  function landArt(g) {
    const sky = g.hue;
    const art = {
      village: `<path d="M0 70h280" stroke="${sky}" stroke-width="1.2" opacity=".55"/><path d="M18 70V48l14-12 14 12v22M62 70V44l16-14 16 14v26" fill="none" stroke="${sky}" stroke-width="1.6" stroke-linejoin="round"/><path d="M118 70V58l8-7 8 7v12" fill="none" stroke="${sky}" stroke-width="1.4"/><path d="M200 70l20-28 14 12 22-32 24 48z" fill="none" stroke="${sky}" stroke-width="1.4" opacity=".7"/><circle cx="248" cy="22" r="7" fill="${sky}" opacity=".35"/>`,
      cliffs: `<path d="M0 78l36-44 22 16 28-36 34 28 40-48 48 40 36-16 36 60z" fill="none" stroke="${sky}" stroke-width="1.6" stroke-linejoin="round"/><path d="M48 78l18-22 16 10 20-26" fill="none" stroke="${sky}" stroke-width="1.2" opacity=".55"/>`,
      tower: `<path d="M0 74h280" stroke="${sky}" stroke-width="1" opacity=".4"/><path d="M124 74V28h32v46M118 28h44M128 16v12M140 16v12M152 16v12M134 42h12v14h-12z" fill="none" stroke="${sky}" stroke-width="1.6"/><path d="M20 74l40-18 60 8 80-22 80 32" fill="none" stroke="${sky}" stroke-width="1.2" opacity=".5"/>`,
      forest: `<path d="M24 78V62M24 30l-16 32h32zM70 78V54M70 22l-22 32h44zM128 78V60M128 34l-18 26h36zM186 78V58M186 28l-20 30h40zM244 78V64M244 38l-14 26h28z" fill="none" stroke="${sky}" stroke-width="1.5" stroke-linejoin="round"/>`,
      peaks: `<path d="M0 78l48-52 28 22 36-40 44 36 40-28 44 28 40 34z" fill="none" stroke="${sky}" stroke-width="1.6" stroke-linejoin="round"/><path d="M40 42l14-16 14 14M148 28l18-20 16 16" fill="none" stroke="${sky}" stroke-width="1.2" opacity=".7"/>`,
      citadel: `<path d="M20 78V40h24v10h24V36h24v10h24V40h24v38zM92 78v-16h24v16M0 78h280" fill="none" stroke="${sky}" stroke-width="1.5" stroke-linejoin="round"/><path d="M44 40v-8M92 36v-8M140 40v-8M188 40v-8" stroke="${sky}" stroke-width="1.5"/>`,
      crossroads: `<path d="M140 78V8M140 28h70l12 10-12 10H140M140 52H70l-12 10 12 10h70" fill="none" stroke="${sky}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="140" cy="40" r="4" fill="${sky}" opacity=".5"/>`
    }[g.id] || "";
    return `<svg class="land-art" viewBox="0 0 280 80" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${art}</svg>`;
  }
  /** Small original landmark per region (SVG, flat, adult palette). */
  function regionArt(g) {
    const art = {
      village: `<path d="M4 26h40" stroke="currentColor"/><path d="M8 26V16l7-6 7 6v10M26 26V18l6-5 6 5v8" fill="none" stroke="currentColor"/>`,
      cliffs: `<path d="M2 26l10-14 6 6 8-12 10 14 8-4v10z" fill="none" stroke="currentColor"/>`,
      tower: `<path d="M18 26V8h12v18M16 8h16M20 4v4M24 4v4M28 4v4M22 14h4v6h-4z" fill="none" stroke="currentColor"/>`,
      forest: `<path d="M10 26V20M10 6l-6 14h12zM26 26V18M26 4l-7 14h14zM40 26v-6M40 10l-5 10h10z" fill="none" stroke="currentColor"/>`,
      peaks: `<path d="M2 26l12-18 7 9 6-7 13 16z M11 13l3-5 3 4" fill="none" stroke="currentColor"/>`,
      citadel: `<path d="M6 26V12h6v4h6v-4h6v4h6v-4h6v14zM20 26v-6h6v6" fill="none" stroke="currentColor"/>`,
      crossroads: `<path d="M24 26V4M24 8h12l3 3-3 3H24M24 16H12l-3 3 3 3h12" fill="none" stroke="currentColor"/>`
    }[g.id] || "";
    return `<svg class="adv-art" viewBox="0 0 48 28" width="48" height="28" aria-hidden="true" style="color:${g.hue}">${art}</svg>`;
  }
  /** Trail behind the nodes: gold where you've walked, dashed ahead. */
  function drawTrail(v) {
    const box = v.querySelector("#adv-path"), svg = v.querySelector("#adv-trail");
    if (!box || !svg) return;
    const bb = box.getBoundingClientRect();
    if (!bb.width) return;
    svg.setAttribute("width", bb.width); svg.setAttribute("height", box.scrollHeight);
    svg.setAttribute("viewBox", `0 0 ${bb.width} ${box.scrollHeight}`);
    const pts = Array.from(box.querySelectorAll(".jnode")).map((el) => {
      const r = el.getBoundingClientRect(), ic = el.querySelector(".jn-icon"), ri = ic ? ic.getBoundingClientRect() : r;
      return { x: ri.left + ri.width / 2 - bb.left, y: ri.top + ri.height / 2 - bb.top, done: el.classList.contains("complete") || el.classList.contains("passed"), region: el.getAttribute("data-region") };
    });
    let d = "", seg = "";
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (a.region !== b.region && (REGIONS.find((g) => g.id === b.region) || {}).open) continue; // side road is its own trail
      const my = (a.y + b.y) / 2, p = `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y} `;
      if (a.done) d += p; else seg += p;
    }
    svg.innerHTML = `<path d="${seg}" class="trail-ahead"/><path d="${d}" class="trail-done"/>`;
  }
  let tokenAt = null;
  function placeToken(v, nodeId) {
    const box = v.querySelector("#adv-path"), tok = v.querySelector("#player-token");
    if (!box || !tok) return;
    const here = box.querySelector(".jnode.here") || box.querySelector(`[data-testid="journey-path-node"][data-node="${nodeId}"] .jnode`) || box.querySelector(`[data-testid="journey-path-node"][data-node="${nodeId}"]`);
    if (!here) { tok.style.display = "none"; return; }
    const bb = box.getBoundingClientRect();
    const r = here.getBoundingClientRect();
    // Sit on the right of the current node so the title stays readable.
    const x = r.left - bb.left + r.width - 22, y = r.top - bb.top + r.height / 2;
    const reduce = document.documentElement.classList.contains("reduced-motion");
    if (tokenAt && !reduce && (tokenAt.node !== nodeId)) {
      tok.style.transition = "none";
      tok.style.left = tokenAt.x + "px"; tok.style.top = tokenAt.y + "px";
      tok.offsetHeight;
      tok.style.transition = "";
    }
    tok.style.left = x + "px"; tok.style.top = y + "px";
    tokenAt = { node: nodeId, x, y };
  }
  function relayout() { const v = document.getElementById("adventure-view"); if (v && !v.hidden && v.querySelector("#adv-path")) { drawTrail(v); const tok = v.querySelector("#player-token"); placeToken(v, tok && tok.getAttribute("data-node")); } }
  if (!window.__advResize) { window.__advResize = true; window.addEventListener("resize", () => { clearTimeout(relayout._t); relayout._t = setTimeout(relayout, 80); }); }
  function openMap() { if (window.UI && window.UI.showTab) window.UI.showTab("adventure"); else { const v = view(); v.hidden = false; render(v); } return true; }

  // ---- rivals ------------------------------------------------------------------------------
  let rivalCtx = null, endSnap = null;
  function snapGame() {
    const b = window.board;
    endSnap = b && b.fen ? { fen: b.fen, last: b.lastMove, flipped: !!b.flipped } : null;
  }
  function portrait(rv, size) {
    const s = size || 72;
    if (window.Portraits && window.Portraits.ids.includes(rv.id)) return window.Portraits.svg(rv.id, s);
    return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" class="rival-art rival-portrait" data-testid="rival-portrait" data-rival="${rv.id}" aria-hidden="true"><defs><linearGradient id="rg-${rv.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${rv.color}"/><stop offset="1" stop-color="#14202a"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#rg-${rv.id})"/><circle cx="50" cy="40" r="16" fill="#0f171d" opacity=".85"/><path d="M22 92c4-22 15-32 28-32s24 10 28 32z" fill="#0f171d" opacity=".85"/><text x="50" y="47" text-anchor="middle" font-size="18" font-family="Georgia,serif" fill="${rv.color}">${esc(rv.name[0])}</text></svg>`;
  }
  function overlay(tid, inner) {
    document.querySelectorAll(".overlay.adv-ov").forEach((x) => x.remove());
    const ov = document.createElement("div");
    ov.className = "overlay adv-ov";
    const TIDS = { "rival-intro": 'data-testid="rival-intro"', "rival-result": 'data-testid="rival-result"', "placement-game": 'data-testid="placement-game"', "placement-result": 'data-testid="placement-result"' };
    ov.setAttribute("data-testid", (TIDS[tid] || "").replace(/^data-testid="|"$/g, "") || tid);
    ov.innerHTML = `<div class="ov-card">${inner}</div>`;
    document.body.appendChild(ov);
    // 1.6.1: a finished game's result card shows the final position, so you can see what happened.
    if (endSnap && window.BoardUI) {
      const host = document.createElement("div"); host.className = "end-board";
      const card = ov.querySelector(".ov-card"), h2 = card.querySelector("h2");
      card.insertBefore(host, h2 ? h2.nextSibling : card.firstChild);
      const b = new window.BoardUI(host, { flipped: endSnap.flipped, showMaterial: false, canMove: () => false, onMove: () => {} });
      b.setPosition(endSnap.fen, endSnap.last);
      endSnap = null;
    }
    return ov;
  }
  function showRivalIntro(regionId, opts) {
    opts = opts || {};
    const g = REGIONS.find((x) => x.id === (regionId || start().region)) || REGIONS[2];
    const rv = RIVALS[g.id];
    const rec = P().rivals[rv.id] || {};
    const isRematch = !!opts.rematch;
    const rematchN = isRematch ? Math.max(1, rec.rematches || 0) : 0;
    const elo = window.Strength.rivalElo(rating(), rematchN);
    rivalCtx = { region: g.id, rv, elo, rematch: rematchN, isRematch };
    const line = isRematch ? (rv.rematch || rv.line) : rv.line;
    const tid = isRematch ? "rival-rematch" : "rival-intro";
    const ov = overlay(tid, `${portrait(rv, 84)}<h2>${esc(rv.name)}</h2><p class="muted">${esc(rv.title)} · ${esc(g.name)}${isRematch ? " · Rematch" : ""}</p>
      <p class="coach-msg">“${esc(line)}”</p><p class="end-stat">Plays about ${Math.round(elo / 50) * 50} (estimate)</p>
      <button type="button" class="primary" id="rv-go">${isRematch ? "Rematch " : "Play "}${esc(rv.name)}</button><button type="button" class="ghost" id="rv-later">Not now</button>`);
    ov.setAttribute("data-testid", "rival-encounter");
    ov.setAttribute("data-rival", rv.id);
    ov.setAttribute("data-rematch", isRematch ? "true" : "false");
    const card = ov.querySelector(".ov-card");
    if (card) card.setAttribute("data-testid", tid);
    $("#rv-go", ov).addEventListener("click", () => { ov.remove(); startRival(); });
    $("#rv-later", ov).addEventListener("click", () => ov.remove());
    return true;
  }
  function startRival() {
    if (!rivalCtx) { const g = REGIONS.find((x) => x.id === start().region); const rv = RIVALS[g.id]; rivalCtx = { region: g.id, rv, elo: window.Strength.rivalElo(rating(), 0), rematch: 0 }; }
    document.querySelectorAll(".overlay.adv-ov").forEach((x) => x.remove());
    if (window.UI && window.UI.hooks && window.UI.hooks.startSparring) {
      window.UI.hooks.startSparring({ opponentId: rivalCtx.rv.persona, bot: { rating: rivalCtx.elo, name: rivalCtx.rv.name, kind: "rival" }, onEnd: rivalEnd });
    }
    return true;
  }
  function rivalEnd(result) {
    snapGame();
    const ctx = rivalCtx || { rv: RIVALS.tower, elo: rating(), region: "tower" };
    const score = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
    const before = rating();
    const r = window.Progress.rate(ctx.elo, score, "rival");
    const rec = P().rivals[ctx.rv.id] = Object.assign({ wins: 0, losses: 0, draws: 0 }, P().rivals[ctx.rv.id]);
    rec[result === "win" ? "wins" : result === "draw" ? "draws" : "losses"]++;
    rec.lastRating = r.estimate; rec.lastAt = Date.now();
    if (ctx.isRematch) rec.rematches = (rec.rematches || 0) + 1;
    if (result !== "loss") completeNode("rival-" + ctx.region);
    window.Progress.save();
    const next = nextStep();
    window.Progress.setNext(next);
    const head = result === "win" ? ctx.rv.name + " concedes." : result === "draw" ? "Honors even." : ctx.rv.name + " takes this one.";
    const quip = result === "win" ? "Noted. I'll be back, stronger." : result === "draw" ? "Respectable. Annoying, but respectable." : "Come back when you've done your homework.";
    const storyLine = result === "win"
      ? (ctx.isRematch ? "Rematch won. " + ctx.rv.name + " will remember that." : ctx.rv.name + " concedes. A rematch opens after you grow.")
      : result === "draw"
        ? (ctx.isRematch ? "Rematch drawn with " + ctx.rv.name + "." : "A draw with " + ctx.rv.name + ". The rematch can wait until you've grown.")
        : ctx.rv.name + " takes this one. The road is still open.";
    logEvent({ kind: "rival", rival: ctx.rv.id, region: ctx.region, title: ctx.rv.name, line: storyLine, result, rematch: !!ctx.isRematch });
    unlockRematch(ctx.region);
    const ov = overlay("rival-result", `${portrait(ctx.rv, 64)}<h2>${esc(head)}</h2><p class="coach-msg">“${esc(quip)}”</p>
      <p class="end-stat">Rating ${before} → ${r.estimate} (estimate)</p>
      <button type="button" class="primary" id="rr-next" data-testid="session-next-step">Next: ${esc(next.label)}, ${next.minutes} min</button>
      <button type="button" class="ghost" id="rr-map">Back to the map</button>`);
    $("#rr-next", ov).addEventListener("click", () => { ov.remove(); next.go(); });
    $("#rr-map", ov).addEventListener("click", () => { ov.remove(); openMap(); });
    rivalCtx = null;
    return true;
  }

  // ---- placement games --------------------------------------------------------------------
  // Adaptive: game 1 at ~1100; win → +400, draw → +100, loss → -350; game 3 jumps +600 on a win.
  // Result = mean of a provisional Glicko-2 period and the adaptive bracket, so 3 wins lands ~2100 with a wide band.
  const JUMP = [{ win: 400, draw: 100, loss: -350 }, { win: 600, draw: 100, loss: -350 }];
  const BRACKET = { win: 250, draw: 0, loss: -200 }; // where the adaptive search points after game 3
  function placementOpp(i, games) {
    if (i === 0) return 1100;
    const prev = games[i - 1];
    return Math.max(300, Math.min(2500, prev.opp + JUMP[i - 1][prev.result]));
  }
  function startPlacement() {
    const pl = P().placement;
    if (pl.status === "done") pl.games = [];
    pl.status = "playing"; window.Progress.save();
    showPlacementCard();
    return true;
  }
  function showPlacementCard() {
    const pl = P().placement, i = pl.games.length;
    if (i >= 3) return finishPlacement([]);
    const opp = placementOpp(i, pl.games);
    const ov = overlay("placement-game", `<p class="muted">Placement · game ${i + 1} of 3</p><h2>Opponent about ${opp}</h2>
      <p class="coach-msg">${i === 0 ? "Three quick games. Play your normal game. The next opponent adjusts to how this goes." : pl.games[i - 1].result === "win" ? "Good. Turning it up." : pl.games[i - 1].result === "loss" ? "Fine. Let's find your level." : "Even. Let's see more."}</p>
      <p class="end-stat">Untimed. Capped at 60 moves, then the engine scores it.</p>
      <button type="button" class="primary" id="pl-go">Play game ${i + 1}</button><button type="button" class="ghost" id="pl-later">Play placement later</button>`);
    $("#pl-go", ov).addEventListener("click", () => {
      ov.remove();
      window.UI.hooks.startSparring({ opponentId: "solid-defender", bot: { rating: opp, name: "Placement bot", kind: "placement", moveCap: 60 }, onEnd: (res) => placementGameEnd(res, opp) });
    });
    $("#pl-later", ov).addEventListener("click", () => { ov.remove(); P().placement.status = "later"; window.Progress.save(); window.UI && window.UI.refresh && window.UI.refresh(); });
  }
  function placementGameEnd(result, opp) {
    snapGame();
    const pl = P().placement;
    pl.games.push({ opp, result, at: Date.now() });
    window.Progress.save();
    if (pl.games.length >= 3) return finishPlacement([]);
    showPlacementCard();
  }
  /** Rate all three games as one provisional period (honest wide RD). qa: results may be simulated. */
  function finishPlacement(results) {
    const pl = P().placement;
    const sim = results && results.results ? results.results : Array.isArray(results) ? results : null;
    const seq = sim && sim.length ? sim : ["win", "draw", "loss"];
    while (pl.games.length < 3) { const i = pl.games.length; pl.games.push({ opp: placementOpp(i, pl.games), result: seq[i % seq.length], sim: true }); }
    const base = { estimate: 1050, rd: 350, vol: 0.06, games: 0, history: [] };
    const r = window.Progress.glicko(base, pl.games.map((g) => ({ rating: g.opp, rd: 80, score: g.result === "win" ? 1 : g.result === "draw" ? 0.5 : 0 })));
    const last = pl.games[2];
    const est = Math.max(100, Math.min(2600, Math.round((r.estimate + last.opp + BRACKET[last.result]) / 2)));
    const rd = Math.max(r.rd, 160);
    P().rating = Object.assign(r, { estimate: est, rd, games: 3, history: [{ at: Date.now(), estimate: est, rd, source: "placement" }] });
    pl.status = "done"; window.Progress.save();
    const g0 = regionFor(est);
    logEvent({ kind: "placement", region: g0.id, title: "Placement", line: "Placement put you at about " + est + ", in " + g0.name + "." });
    showPlacementResult();
    return true;
  }
  function showPlacementResult() {
    const r = P().rating, b = window.Progress.band(), g = regionFor(r.estimate);
    const ov = overlay("placement-result", `<p class="muted">Your starting point</p><h2 class="pr-num" data-estimate="${r.estimate}">About ${r.estimate}</h2>
      <p class="end-stat">Estimate, likely ${b.low}–${b.high}. It narrows as you play.</p>
      <p class="coach-msg">You start in ${esc(g.name)}. Earlier lands stay on the path behind you.</p>
      <button type="button" class="primary" id="pr-go">Enter ${esc(g.name)}</button>`);
    ov.setAttribute("data-estimate", r.estimate);
    $("#pr-go", ov).addEventListener("click", () => { ov.remove(); openMap(); });
  }
  function brandNew() { P().placement.status = "new"; window.Progress.setRating(600, 300); P().rating.games = 0; window.Progress.save(); }
  function playLater() { P().placement.status = "later"; window.Progress.save(); }

  // ---- journey log --------------------------------------------------------------------------
  function sparkline(hist, w, h) {
    const pts = (hist || []).filter((x) => x.estimate);
    if (pts.length < 2) return `<svg width="${w}" height="${h}" class="spark"><text x="4" y="${h / 2}" fill="#8aa0ad" font-size="12">Play a few games to draw this.</text></svg>`;
    const lo = Math.min(...pts.map((p) => p.estimate)) - 30, hi = Math.max(...pts.map((p) => p.estimate)) + 30;
    const xy = pts.map((p, i) => [4 + i * (w - 8) / (pts.length - 1), h - 4 - (p.estimate - lo) / (hi - lo) * (h - 8)]);
    return `<svg width="${w}" height="${h}" class="spark" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="#d9a441" stroke-width="2.5" points="${xy.map((p) => p.join(",")).join(" ")}"/><circle cx="${xy[xy.length - 1][0]}" cy="${xy[xy.length - 1][1]}" r="4" fill="#d9a441"/></svg>`;
  }
  function logStats() {
    const s = P(), hist = s.rating.history || [];
    const first = hist[0] ? hist[0].estimate : s.rating.estimate;
    const b0 = s.bosses[0], bN = s.bosses[s.bosses.length - 1];
    const retired = s.retired || 0; // mistakes cleared by two clean reviews in a row
    return { name: (s.character && s.character.name) || "Player", now: s.rating.estimate, first, rd: s.rating.rd, games: s.rating.games, level: window.Progress.levelOf(s.xp).level, b0, bN, retired, badges: Object.keys(s.badges), streakBest: s.streak.best, days: Math.max(1, Math.round((Date.now() - s.firstSeen) / 86400000)) };
  }
  function storyEntries(s, st, badgeName) {
    const rows = (s.story || []).slice();
    // Fill gaps from stored state so older saves still tell a story.
    Object.keys(s.arrivals || {}).forEach((id) => {
      if (!rows.some((e) => e.kind === "region" && e.region === id)) {
        const g = regionById(id);
        if (g) rows.push({ kind: "region", region: id, at: s.arrivals[id], title: g.name, line: "You reached " + g.name.replace(/^The /, "") + "." });
      }
    });
    Object.keys(s.crossed || {}).forEach((id) => {
      if (!rows.some((e) => e.kind === "crossed" && e.region === id)) {
        const g = regionById(id);
        if (g) rows.push({ kind: "crossed", region: id, at: s.crossed[id], title: g.name, line: "You crossed " + g.name.replace(/^The /, "") + "." });
      }
    });
    Object.values(RIVALS).forEach((rv) => {
      const r = s.rivals && s.rivals[rv.id];
      if (!r || !((r.wins || 0) + (r.draws || 0) + (r.losses || 0))) return;
      if (!rows.some((e) => e.kind === "rival" && e.rival === rv.id)) {
        const line = r.wins ? rv.name + " has conceded." : r.draws ? "A draw with " + rv.name + "." : rv.name + " took a game.";
        rows.push({ kind: "rival", rival: rv.id, at: r.lastAt || 0, title: rv.name, line });
      }
    });
    (st.badges || []).forEach((id) => {
      if (!rows.some((e) => e.kind === "moment" && e.badge === id)) {
        rows.push({ kind: "moment", badge: id, at: (s.badges && s.badges[id]) || 0, title: badgeName(id), line: "Best moment: " + badgeName(id) + ". Earned on the board." });
      }
    });
    rows.sort((a, b) => (a.at || 0) - (b.at || 0));
    if (!rows.length) {
      return `<li class="jlog-entry" data-testid="journey-log-entry" data-kind="empty"><p>The road is still ahead. Tess Vane is waiting in the Village.</p></li>`;
    }
    return rows.map((e) => {
      const rv = e.rival && Object.values(RIVALS).find((x) => x.id === e.rival);
      const face = rv ? portrait(rv, 36) : "";
      return `<li class="jlog-entry" data-testid="journey-log-entry" data-kind="${esc(e.kind)}"${e.region ? ` data-region="${esc(e.region)}"` : ""}${e.rival ? ` data-rival="${esc(e.rival)}"` : ""}>${face}<div><b>${esc(e.title || "")}</b><p>${esc(e.line)}</p></div></li>`;
    }).join("");
  }
  function openLog() {
    if (window.UI && window.UI.showTab) window.UI.showTab("adventure");
    const v = view(), st = logStats(), s = P();
    const badgeName = (window.Badges && window.Badges.name) || ((id) => id);
    const mainEl = document.querySelector(".main"); if (mainEl) mainEl.scrollTop = 0; // the log opens at its top, not where the map was scrolled
    const entries = storyEntries(s, st, badgeName);
    v.innerHTML = `<div class="jlog" data-testid="journey-log">
      <div class="adv-head">${avatarSVG(s.character, 52)}<div><b>${esc(st.name)}</b><span class="muted"> · ${st.days} day${st.days === 1 ? "" : "s"} on the road</span></div></div>
      <button type="button" class="primary" data-testid="journey-share" id="journey-share">Share your journey card</button>
      <div class="jlog-share"><img data-testid="journey-share-image" id="jl-img" alt="Your journey card" width="300"></div>
      <h3>The road so far</h3>
      <ol class="jlog-story">${entries}</ol>
      <h3>Rating</h3><p class="end-stat">${st.first !== st.now ? st.first + " → " : "Now "}<b>${st.now}</b> · likely ${Math.max(100, st.now - st.rd * 2)}–${Math.min(2600, st.now + st.rd * 2)}</p>${sparkline(s.rating.history, 320, 70)}
      <button type="button" class="ghost" id="jl-back">Back to the map</button></div>`;
    shareImage().then((url) => { const im = $("#jl-img", v); if (im) im.src = url; });
    $("#journey-share", v).addEventListener("click", async () => {
      const url = await shareImage();
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], "sparring-coach-journey.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "My chess journey" }); return; }
      } catch (e) {}
      const a = document.createElement("a"); a.href = url; a.download = "sparring-coach-journey.png"; a.click();
    });
    $("#jl-back", v).addEventListener("click", () => render(v));
    return true;
  }
  /** Journey card drawn locally on a canvas. Nothing is uploaded. */
  async function shareImage() {
    const st = logStats();
    const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
    const x = c.getContext("2d");
    const grd = x.createLinearGradient(0, 0, 1080, 1350); grd.addColorStop(0, "#1b2a34"); grd.addColorStop(1, "#0f171d");
    x.fillStyle = grd; x.fillRect(0, 0, 1080, 1350);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) { x.fillStyle = "rgba(255,255,255,0.025)"; x.fillRect(i * 135, 600 + j * 94, 135, 94); }
    x.fillStyle = "#d9a441"; x.font = "600 44px Georgia, serif"; x.fillText("Sparring Coach", 80, 130);
    x.fillStyle = "#e8eef2"; x.font = "700 92px Georgia, serif"; x.fillText(st.name, 80, 260);
    x.font = "400 44px system-ui, sans-serif"; x.fillStyle = "#9fb3bf"; x.fillText("Rating estimate", 80, 380);
    x.fillStyle = "#e8eef2"; x.font = "700 120px system-ui, sans-serif"; x.fillText(String(st.now), 80, 510);
    x.font = "400 46px system-ui, sans-serif"; x.fillStyle = st.now >= st.first ? "#7fc49a" : "#d98b7a";
    x.fillText((st.now >= st.first ? "▲ " : "▼ ") + Math.abs(st.now - st.first) + " since day one", 80, 580);
    const rows = [["Level", st.level], ["Mistakes retired", st.retired], ["Badges", st.badges.length], ["Best streak", st.streakBest + (st.streakBest === 1 ? " day" : " days")]];
    rows.forEach((r, i) => { x.fillStyle = "#9fb3bf"; x.font = "400 42px system-ui"; x.fillText(r[0], 80, 760 + i * 110); x.fillStyle = "#e8eef2"; x.font = "700 52px system-ui"; x.fillText(String(r[1]), 640, 760 + i * 110); });
    x.fillStyle = "#6f8593"; x.font = "400 30px system-ui"; x.fillText("Estimates from games on this device.", 80, 1270);
    return c.toDataURL("image/png");
  }

  // ---- generic show() for QA and deep links -----------------------------------------------------
  function show(id, arg) {
    if (id === "rival-intro" || id === "rival-encounter") return showRivalIntro(arg);
    if (id === "rival-rematch") {
      const hit = Object.keys(RIVALS).find((rid) => rematchReady(rid)) || Object.keys(RIVALS).find((rid) => {
        const rv = RIVALS[rid], rec = P().rivals[rv.id];
        return rec && ((rec.wins || 0) + (rec.draws || 0) > 0);
      }) || start().region;
      return showRivalIntro(hit, { rematch: true });
    }
    if (id === "region-arrival") { openMap(); return true; }
    if (id === "rival-result") { rivalEnd("draw"); return true; }
    if (id === "placement-game") return startPlacement();
    if (id === "placement-result") return finishPlacement([]);
    if (id === "journey-log") return openLog();
    if (id === "character-create") { openCreate(!!getCharacter()); return true; }
    return false;
  }

  const api = {
    REGIONS, RIVALS, regionFor, start, nodes, trailNodes, rematchReady, logEvent, path: buildPath, nodeForLesson, completeNode, completeFromLesson, startNode, nextStep,
    getCharacter, setCharacter, avatarSVG, openCreate: () => openCreate(false), openEditor: () => openCreate(true), ensureCharacter,
    render, open: openMap, openMap, openLog, shareImage, show,
    showRivalIntro, startRival, endRival: (r) => rivalEnd(r || "draw"), rivalEnd,
    startPlacement, finishPlacement, placementGameEnd, brandNew, playLater,
    setRating: (n) => window.Progress.setRating(n),
    get lessonToNode() { const o = {}; buildPath().forEach((n) => { if (n.lesson) o[n.lesson] = n.id; }); return o; },
    bossStrength: () => window.Strength.bossElo(rating()), rivalStrength: () => window.Strength.rivalElo(rating(), 0)
  };
  window.Adventure = api;
  window.Journey = api;
  window.__qa = window.__qa || {};
  window.__qa.rivals = Object.keys(RIVALS).map((region) => ({ id: RIVALS[region].id, name: RIVALS[region].name, persona: RIVALS[region].persona, region }));
  window.Character = api;
})();
