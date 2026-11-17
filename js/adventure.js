/* Adventure frame: character, journey path through regions, rivals, placement games,
   journey log. Shares one rating/XP/badge store with Train (window.Progress). Original art, no real players. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const P = () => window.Progress.get();
  const rating = () => P().rating.estimate;

  // ---- regions & rivals --------------------------------------------------------
  const REGIONS = [
    { id: "village", unit: 0, name: "The Village", topic: "Basics", band: [0, 699], hue: "#c9a76a" },
    { id: "cliffs", unit: 1, name: "Mating Grounds", topic: "Checkmates", band: [700, 899], hue: "#b8735a" },
    { id: "tower", unit: 2, name: "The Watchtower", topic: "Safety", band: [900, 1099], hue: "#7d8fa3" },
    { id: "forest", unit: 3, name: "Tactics Forest", topic: "Tactics", band: [1100, 1299], hue: "#5f8a6a" },
    { id: "peaks", unit: 5, name: "Endgame Peaks", topic: "Endgames", band: [1300, 9999], hue: "#9aa7b8" },
    { id: "crossroads", unit: 4, name: "Opening Crossroads", topic: "Openings", soon: "1.6.1", hue: "#8a7a9a" }
  ];
  // Fictional rivals built on the CC0-book personas. Strength scales with your rating.
  const RIVALS = {
    village: { id: "vane", name: "Tess Vane", title: "The Opportunist", persona: "wing-pawn-opener", color: "#c9a76a", line: "Leave something loose and I'll take it. Nothing personal. Mostly." },
    cliffs: { id: "ember", name: "Ember", title: "The Attacker", persona: "gambiteer", color: "#c4623f", line: "I bring pawns as gifts. The bill comes later, aimed at your king." },
    tower: { id: "bastion", name: "Bastion", title: "The Wall", persona: "solid-defender", color: "#6f8296", line: "I don't attack. I wait. Most people get bored first." },
    forest: { id: "quill", name: "Quill", title: "The Trickster", persona: "wing-pawn-opener", color: "#5f8a6a", line: "Every move I make looks harmless. That's the point." },
    peaks: { id: "gale", name: "Old Gale", title: "The Grinder", persona: "fianchetto-grinder", color: "#8c97a6", line: "Trade down with me if you like. I've been winning endgames since before you castled." }
  };
  function regionFor(r) { const x = REGIONS.filter((g) => !g.soon).find((g) => r >= g.band[0] && r <= g.band[1]); return x || REGIONS[0]; }

  // ---- journey nodes -------------------------------------------------------------
  function regionLessons(g) { const u = window.Lessons && window.Lessons.units().find((x) => x.id === g.unit); return u ? u.lessons : []; }
  function buildPath() {
    const out = [];
    for (const g of REGIONS) {
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
  function nodes() {
    const st = start(), r = st.rating, path = buildPath();
    const entryIdx = path.findIndex((n) => n.region === st.region);
    let prevDone = true;
    return path.slice(Math.max(0, entryIdx)).map((n, i) => {
      const complete = !!(P().nodes[n.id] && P().nodes[n.id].complete);
      const tierLocked = n.tier > r;
      const locked = tierLocked || !prevDone;
      if (!tierLocked) prevDone = complete;
      return Object.assign({}, n, { index: i, complete, locked, tierLocked });
    });
  }
  function nodeForLesson(lessonId) { const n = buildPath().find((x) => x.lesson === lessonId); return n ? Object.assign({}, n, { complete: !!(P().nodes[n.id] && P().nodes[n.id].complete) }) : null; }
  function completeNode(id) { P().nodes[id] = { complete: true, at: Date.now() }; window.Progress.save(); return true; }
  function completeFromLesson(lessonId) { const n = nodeForLesson(lessonId); if (n) completeNode(n.id); return n; }
  function startNode(id) {
    const n = nodes().find((x) => x.id === id);
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
    const n = list.slice(at + 1).find((x) => !x.complete && !x.tierLocked) || list.find((x) => !x.complete && !x.tierLocked);
    if (!n) return { label: "Rush round", minutes: 3, go: () => window.Rush && window.Rush.open() };
    const g = REGIONS.find((x) => x.id === n.region);
    const mins = n.kind === "rival" ? 8 : n.kind === "rush" ? 3 : window.Lessons.minutes(window.Lessons.lesson(n.lesson) || {});
    const label = n.kind === "rival" ? g.name.replace(/^The /, "") + " rival" : n.kind === "boss" ? g.name.replace(/^The /, "") + " test" : n.title;
    return { label, minutes: mins, node: n.id, go: () => { if (window.UI) window.UI.showTab("adventure"); startNode(n.id); } };
  }

  // ---- character -------------------------------------------------------------------
  const PARTS = {
    tone: ["#e8c4a0", "#d1a07a", "#a8714e", "#7a4e33", "#4e3324"],
    hair: ["short", "crop", "long", "bun", "cap", "beanie"],
    outfit: ["#2f4858", "#5b3a4a", "#3c5a3f", "#6b5a3a", "#3a3f5c"],
    acc: ["none", "glasses", "scarf", "earring", "headphones"]
  };
  function getCharacter() { return P().character; }
  function setCharacter(c) { P().character = Object.assign({ tone: 1, hair: 0, outfit: 0, acc: 0, name: "Player" }, P().character || {}, c); window.Progress.save(); return P().character; }
  function avatarSVG(c, size) {
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
    ov.innerHTML = `<div class="cc-card"><h2>${edit ? "Edit your character" : "Who's playing?"}</h2><p class="muted">Looks only. Stays on this device.</p>
      <div class="cc-preview" id="cc-preview">${avatarSVG(c, 112)}</div>
      <input id="character-name" data-testid="character-name" maxlength="18" placeholder="Your name" value="${esc(c.name)}" autocomplete="off">
      ${row("tone", "Skin", 5)}${row("hair", "Hair", 6)}${row("outfit", "Outfit", 5)}${row("acc", "Extra", 5)}
      <button type="button" class="primary" data-testid="character-save" id="cc-save">${edit ? "Save" : "Start"}</button></div>`;
    document.body.appendChild(ov);
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
    const st = start(), list = nodes(), c = getCharacter();
    const lv = window.Progress.levelOf(P().xp);
    const entryG = REGIONS.findIndex((g) => g.id === st.region);
    const passed = REGIONS.slice(0, entryG).filter((g) => !g.soon);
    const ent = window.Entitlements ? window.Entitlements.regionTiers(st.region) : {};
    let html = `<div class="adv" data-testid="journey-map">
      <div class="adv-head">${avatarSVG(c, 52)}<div><b>${esc((c && c.name) || "Player")}</b><span class="muted"> · Level ${lv.level} · ${esc(window.Progress.ratingLabel())}</span>
      <div class="xpbar"><i style="width:${Math.round(lv.into / lv.need * 100)}%"></i></div></div>
      <button type="button" class="ghost tiny" id="adv-log" data-testid="journey-log-open">Journey log</button></div>`;
    const nx = nextStep();
    if (nx) html += `<button type="button" class="primary adv-next" id="adv-next" data-testid="session-next-step">Next: ${esc(nx.label)}, ${nx.minutes} min</button>`;
    if (passed.length) html += `<div class="adv-passed">${passed.map((g) => `<button type="button" class="chip passed" data-region="${g.id}">✓ ${esc(g.name)} · Passed</button>`).join("")}</div>`;
    let lastRegion = null;
    for (const n of list) {
      if (n.region !== lastRegion) {
        const g = REGIONS.find((x) => x.id === n.region);
        html += `<div class="adv-region" style="--hue:${g.hue}"><span class="adv-rname">${esc(g.name)}</span><span class="muted"> ${esc(g.topic)}</span>${ent[g.id] === "pro" ? "" : ""}</div>`;
        lastRegion = n.region;
      }
      const isEntry = n.id === st.node;
      const icon = { lesson: "●", boss: "♛", rival: "⚔", rush: "⚡" }[n.kind];
      html += `<button type="button" class="jnode ${n.kind}${n.complete ? " complete" : ""}${n.locked ? " locked" : ""}${isEntry ? " here" : ""}" data-testid="journey-node" data-node="${esc(n.id)}" data-index="${n.index}" data-kind="${n.kind}" data-locked="${n.locked}" data-complete="${n.complete}" ${n.lesson ? `data-lesson="${esc(n.lesson)}"` : ""} ${n.locked ? 'aria-disabled="true"' : ""}>
        <span class="jn-icon">${n.complete ? "✓" : icon}</span><span class="jn-title">${esc(n.title)}</span>
        ${n.tierLocked ? `<span class="jn-meta">Opens near ${n.tier}</span>` : isEntry ? `<span class="jn-here">${avatarSVG(c, 28)}</span>` : ""}
        ${isEntry ? `<span hidden data-testid="adventure-entry-node" data-node="${esc(n.id)}" data-unit="${st.unit}" data-title="${esc(n.title)}"></span>` : ""}</button>`;
    }
    html += `<div class="adv-region soon"><span class="adv-rname">Opening Crossroads</span><span class="muted"> Coming in 1.6.1</span></div></div>`;
    v.innerHTML = html;
    v.querySelectorAll("[data-testid=journey-node]").forEach((b) => b.addEventListener("click", () => {
      if (b.getAttribute("data-locked") === "true") { b.classList.add("shake"); setTimeout(() => b.classList.remove("shake"), 400); return; }
      startNode(b.getAttribute("data-node"));
    }));
    v.querySelectorAll("[data-region]").forEach((b) => b.addEventListener("click", () => {
      const g = REGIONS.find((x) => x.id === b.getAttribute("data-region"));
      if (window.UI) window.UI._lessonBack = "adventure";
      const first = regionLessons(g)[0]; if (first) window.Lessons.start(first.id, { from: "adventure" });
    }));
    $("#adv-log", v).addEventListener("click", openLog);
    const nb = $("#adv-next", v); if (nb && nx) nb.addEventListener("click", () => nx.go());
    const here = v.querySelector(".jnode.here"); if (here && here.scrollIntoView) setTimeout(() => here.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
  }
  function openMap() { if (window.UI && window.UI.showTab) window.UI.showTab("adventure"); else { const v = view(); v.hidden = false; render(v); } return true; }

  // ---- rivals ------------------------------------------------------------------------------
  let rivalCtx = null;
  function portrait(rv, size) {
    const s = size || 72;
    return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" class="rival-art" aria-hidden="true"><defs><linearGradient id="rg-${rv.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${rv.color}"/><stop offset="1" stop-color="#14202a"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#rg-${rv.id})"/><circle cx="50" cy="40" r="16" fill="#0f171d" opacity=".85"/><path d="M22 92c4-22 15-32 28-32s24 10 28 32z" fill="#0f171d" opacity=".85"/><text x="50" y="47" text-anchor="middle" font-size="18" font-family="Georgia,serif" fill="${rv.color}">${esc(rv.name[0])}</text></svg>`;
  }
  function overlay(tid, inner) {
    document.querySelectorAll(".overlay.adv-ov").forEach((x) => x.remove());
    const ov = document.createElement("div");
    ov.className = "overlay adv-ov";
    const TIDS = { "rival-intro": 'data-testid="rival-intro"', "rival-result": 'data-testid="rival-result"', "placement-game": 'data-testid="placement-game"', "placement-result": 'data-testid="placement-result"' };
    ov.setAttribute("data-testid", (TIDS[tid] || "").replace(/^data-testid="|"$/g, "") || tid);
    ov.innerHTML = `<div class="ov-card">${inner}</div>`;
    document.body.appendChild(ov);
    return ov;
  }
  function showRivalIntro(regionId) {
    const g = REGIONS.find((x) => x.id === (regionId || start().region)) || REGIONS[2];
    const rv = RIVALS[g.id];
    const rec = P().rivals[rv.id] || {};
    const rematch = rec.wins ? 1 : 0;
    const elo = window.Strength.rivalElo(rating(), rematch);
    rivalCtx = { region: g.id, rv, elo, rematch };
    const ov = overlay("rival-intro", `${portrait(rv, 84)}<h2>${esc(rv.name)}</h2><p class="muted">${esc(rv.title)} · ${esc(g.name)}</p>
      <p class="coach-msg">“${esc(rv.line)}”</p><p class="end-stat">Plays about ${Math.round(elo / 50) * 50}${rematch ? " · Rematch" : ""} (estimate)</p>
      <button type="button" class="primary" id="rv-go">Play ${esc(rv.name)}</button><button type="button" class="ghost" id="rv-later">Not now</button>`);
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
    const ctx = rivalCtx || { rv: RIVALS.tower, elo: rating(), region: "tower" };
    const score = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
    const before = rating();
    const r = window.Progress.rate(ctx.elo, score, "rival");
    const rec = P().rivals[ctx.rv.id] = Object.assign({ wins: 0, losses: 0, draws: 0 }, P().rivals[ctx.rv.id]);
    rec[result === "win" ? "wins" : result === "draw" ? "draws" : "losses"]++;
    if (result !== "loss") completeNode("rival-" + ctx.region);
    window.Progress.save();
    const next = nextStep();
    window.Progress.setNext(next);
    const head = result === "win" ? ctx.rv.name + " concedes." : result === "draw" ? "Honors even." : ctx.rv.name + " takes this one.";
    const quip = result === "win" ? "Noted. I'll be back, stronger." : result === "draw" ? "Respectable. Annoying, but respectable." : "Come back when you've done your homework.";
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
    showPlacementResult();
    return true;
  }
  function showPlacementResult() {
    const r = P().rating, b = window.Progress.band(), g = regionFor(r.estimate);
    const ov = overlay("placement-result", `<p class="muted">Your starting point</p><h2 class="pr-num" data-estimate="${r.estimate}">About ${r.estimate}</h2>
      <p class="end-stat">Estimate, likely ${b.low}–${b.high}. It narrows as you play.</p>
      <p class="coach-msg">You start in ${esc(g.name)}. Earlier regions are marked Passed. Visit any time.</p>
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
  function openLog() {
    if (window.UI && window.UI.showTab) window.UI.showTab("adventure");
    const v = view(), st = logStats(), s = P();
    const badgeName = (window.Badges && window.Badges.name) || ((id) => id);
    v.innerHTML = `<div class="jlog" data-testid="journey-log">
      <div class="adv-head">${avatarSVG(s.character, 52)}<div><b>${esc(st.name)}</b><span class="muted"> · ${st.days} day${st.days === 1 ? "" : "s"} on the road</span></div></div>
      <div class="jlog-share"><img data-testid="journey-share-image" id="jl-img" alt="Your journey card" width="300"></div>
      <button type="button" class="primary" data-testid="journey-share" id="journey-share">Share your journey card</button>
      <h3>Rating</h3><p class="end-stat">${st.first !== st.now ? st.first + " → " : "Now "}<b>${st.now}</b> · likely ${Math.max(100, st.now - st.rd * 2)}–${Math.min(2600, st.now + st.rd * 2)}</p>${sparkline(s.rating.history, 320, 70)}
      <h3>Bosses</h3><p>${st.b0 ? `First: ${esc(st.b0.id)} at ~${st.b0.rating}. Latest: ${esc(st.bN.id)} at ~${st.bN.rating}.` : "No bosses yet. The first one is waiting."}</p>
      <h3>Mistakes you've stopped making</h3><p class="end-stat">${st.retired}</p>
      <h3>Badges</h3><div class="badges">${st.badges.length ? st.badges.map((b) => `<span class="chip badge">${esc(badgeName(b))}</span>`).join("") : "<span class='muted'>Earned from your real games and big moments.</span>"}</div>
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
  function show(id) {
    if (id === "rival-intro") return showRivalIntro();
    if (id === "rival-result") { rivalEnd("draw"); return true; }
    if (id === "placement-game") return startPlacement();
    if (id === "placement-result") return finishPlacement([]);
    if (id === "journey-log") return openLog();
    if (id === "character-create") { openCreate(!!getCharacter()); return true; }
    return false;
  }

  const api = {
    REGIONS, RIVALS, regionFor, start, nodes, path: buildPath, nodeForLesson, completeNode, completeFromLesson, startNode, nextStep,
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
  window.Character = api;
})();
