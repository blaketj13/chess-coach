/* 1.6.1 Calculation and visualization drills (Train). Two item types, tiered by rating:
   - Count: how many checks (or captures) does the side to move have? Tap a number.
   - Mind's eye: read a short line from the shown position, then find the next move with the
     moved pieces (or, near 1800+, every piece) hidden. Answers are engine-verified at build time.
   Feeds the shared rating (mind's-eye items are rated puzzles), XP, combos and badges. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let DATA = null, loading = null, run = null;
  const SET = 6;
  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (!loading) loading = fetch("data/train/calc.json").then((r) => r.json()).then((d) => (DATA = d));
    return loading;
  }
  const P = () => window.Progress;
  const rating = () => (P() ? P().get().rating.estimate : 1000);
  /** Tier by rating: line length and how much is hidden. */
  function tier(r) {
    if (r < 1200) return { plies: 1, fog: "moved", count: ["checks"], label: "One move ahead" };
    if (r < 1800) return { plies: 3, fog: "moved", count: ["checks", "captures"], label: "Three moves ahead" };
    if (r < 2200) return { plies: 3, fog: "all", count: ["checks", "captures"], label: "Three moves, blindfold" };
    return { plies: 5, fog: "all", count: ["captures", "checks"], label: "Five moves, blindfold" };
  }
  function near(list, r, n, used) {
    return list.map((x, i) => ({ x, i, d: Math.abs(x.rating - r) + Math.random() * 120 })).filter((o) => !used.has(o.x.src)).sort((a, b) => a.d - b.d).slice(0, n).map((o) => o.x);
  }
  function buildSet(r) {
    const t = tier(r), used = new Set();
    const vis = near(DATA.vis.filter((v) => v.plies === t.plies), r, 3, used); vis.forEach((v) => used.add(v.src));
    const cnt = near(DATA.checks, r, 3, used);
    const items = [];
    for (let i = 0; i < SET / 2; i++) {
      if (cnt[i]) items.push({ type: "count", q: t.count[i % t.count.length], item: cnt[i] });
      if (vis[i]) items.push({ type: "vis", fog: t.fog, item: vis[i] });
    }
    return { t, items };
  }
  function view() {
    let v = document.getElementById("calc-view");
    if (!v) { v = document.createElement("section"); v.id = "calc-view"; v.hidden = true; document.querySelector(".main").appendChild(v); }
    document.querySelectorAll(".main > section").forEach((s) => { s.hidden = s !== v; });
    v.hidden = false;
    return v;
  }
  function overlayStart() {
    document.querySelectorAll(".overlay.calc-ov").forEach((x) => x.remove());
    const t = tier(rating());
    const ov = document.createElement("div");
    ov.className = "overlay calc-ov";
    ov.innerHTML = `<div class="ov-card" data-testid="calc-start"><div class="cel-mark">◎</div><h2>Calculation</h2><p class="coach-msg">Six positions. Count what's there, then see what isn't. No peeking.</p><p class="end-stat">Your level: ${esc(t.label)}</p><button type="button" class="primary" id="calc-go">Start the set</button><button type="button" class="ghost" id="calc-x">Not now</button></div>`;
    document.body.appendChild(ov);
    $("#calc-go", ov).addEventListener("click", () => { ov.remove(); begin(); });
    $("#calc-x", ov).addEventListener("click", () => ov.remove());
    return true;
  }
  async function begin(opts) {
    await load();
    const r = (opts && opts.rating) || rating();
    const set = buildSet(r);
    run = { t: set.t, items: set.items, i: 0, clean: 0, xp: 0, results: [], startedAt: Date.now(), miss: false, blind: false };
    if (window.AppChrome) { window.AppChrome.setTitle("Calculation"); window.AppChrome.setBack(() => quit()); }
    render();
    return true;
  }
  function quit() { run = null; if (window.UI) window.UI.showTab("train"); }
  function dots() { return run.items.map((x, j) => `<i class="ls-dot${j < run.i ? " done" : j === run.i ? " on" : ""}"></i>`).join(""); }
  function render() {
    const v = view();
    const it = run.items[run.i];
    if (!it) return complete();
    run.miss = false; run.tries = 0;
    if (it.type === "count") return renderCount(v, it);
    return renderVis(v, it);
  }
  // ---- count the checks / captures ---------------------------------------------------------
  function renderCount(v, it) {
    const side = it.item.side === "b" ? "Black" : "White";
    const n = it.item[it.q].length, max = Math.max(4, Math.min(7, n + 2));
    v.innerHTML = `<div class="calc" data-testid="calc-count" data-answer="${n}" data-q="${it.q}">
      <div class="ls-top"><div class="ls-dots">${dots()}</div></div>
      <p class="coach-msg ls-prompt">How many ${it.q} does ${side} have? Every one counts, even the bad ones.</p>
      <div id="calc-board" class="ls-board calc-board"></div>
      <div class="calc-chips">${Array.from({ length: max + 1 }, (_, k) => `<button type="button" data-n="${k}" data-testid="calc-chip">${k}</button>`).join("")}</div></div>`;
    run.board = new BoardUI($("#calc-board", v), { flipped: it.item.side === "b", showMaterial: false, onMove: () => {}, canMove: () => false });
    run.board.setPosition(it.item.fen, null);
    v.querySelectorAll("[data-n]").forEach((b) => b.addEventListener("click", () => answerCount(it, +b.getAttribute("data-n"), b)));
  }
  function arrowsFor(it) {
    const c = new Chess(it.item.fen);
    const want = new Set(it.item[it.q]);
    return c.moves({ verbose: true }).filter((m) => want.has(m.san)).map((m) => ({ from: m.from, to: m.to, color: it.q === "checks" ? "#d9a441" : "#6fa8dc" }));
  }
  function answerCount(it, k, btn) {
    if (run.locked) return;
    const list = it.item[it.q], n = list.length;
    run.tries++;
    if (k === n) {
      btn.classList.add("right");
      run.board.setArrows(arrowsFor(it));
      return finishItem(!run.miss, n ? `${n}: ${list.join(", ")}.` : "None. Sometimes the answer is zero.");
    }
    run.miss = true;
    btn.classList.add("wrong");
    if (window.Feel) window.Feel.sound("miss");
    if (run.tries >= 2) { run.board.setArrows(arrowsFor(it)); return finishItem(false, `It was ${n}${n ? ": " + list.join(", ") : ""}.`); }
    feedback(k < n ? `Not ${k}. You missed at least one.` : `Not ${k}. Some of those aren't legal ${it.q}.`,
      it.q === "checks" ? "Hint: go piece by piece. Knights and discovered checks hide best." : "Hint: go piece by piece, including the king and pawns.");
  }
  // ---- mind's eye ---------------------------------------------------------------------------
  function lineText(item) {
    const c = new Chess(item.fen0);
    let num = +item.fen0.split(" ")[5] || 1, white = c.turn() === "w", out = [];
    item.sans.forEach((s, j) => { out.push(white ? num + "." + s : (j === 0 ? num + "..." + s : s)); if (!white) num++; white = !white; });
    return out.join(" ");
  }
  function renderVis(v, it) {
    const item = it.item, side = new Chess(item.fen).turn();
    v.innerHTML = `<div class="calc" data-testid="calc-vis" data-phase="read" data-answer="${esc(item.ans)}" data-alternates="${esc(item.accept.join(","))}" data-fen="${esc(item.fen)}">
      <div class="ls-top"><div class="ls-dots">${dots()}</div></div>
      <p class="coach-msg ls-prompt">Picture this line from here. Then ${side === "w" ? "White" : "Black"} has a strong move.</p>
      <p class="calc-line" data-testid="calc-line">${esc(lineText(item))}</p>
      <div id="calc-board" class="ls-board calc-board"></div>
      <button type="button" class="primary" id="calc-ready" data-testid="calc-ready">I see it</button></div>`;
    run.board = new BoardUI($("#calc-board", v), { flipped: side === "b", showMaterial: false, onMove: (m) => moveVis(it, m), canMove: () => run && run.phase === "play" && !run.locked });
    run.phase = "read";
    run.board.setPosition(item.fen0, null);
    $("#calc-ready", v).addEventListener("click", () => toPlay(it));
  }
  function fogStyle(it) {
    const st = document.getElementById("calc-fog") || Object.assign(document.createElement("style"), { id: "calc-fog" });
    document.head.appendChild(st);
    if (it.fog === "all") { st.textContent = ""; $("#calc-board").classList.add("fog-all"); return; }
    const sq = new Set(it.item.line.map((u) => u.slice(2, 4)));
    st.textContent = Array.from(sq).map((s) => `#calc-board:not(.reveal) [data-sq="${s}"] .cb-piece`).join(",") + "{opacity:0}";
  }
  function toPlay(it) {
    run.phase = "play";
    const v = document.getElementById("calc-view");
    $(".calc", v).setAttribute("data-phase", "play");
    $("#calc-ready", v).remove();
    $(".ls-prompt", v).textContent = it.fog === "all" ? "All pieces hidden. Play the move from memory." : "Moved pieces are hidden. Play the move.";
    run.board.setPosition(it.item.fen, null);
    fogStyle(it);
  }
  function moveVis(it, m) {
    if (!run || run.locked) return;
    const u = m.from + m.to + (m.promotion || "");
    const c = new Chess(it.item.fen), mm = c.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });
    if (!mm) return;
    run.tries++;
    if (it.item.accept.includes(u) || (mm && c.in_checkmate())) {
      $("#calc-board").classList.add("reveal");
      run.board.setPosition(c.fen(), { from: m.from, to: m.to });
      if (window.Feel) window.Feel.moved(mm, c);
      run.results.push({ rating: it.item.rating + (it.fog === "all" ? 100 : 0), rd: 80, score: run.miss ? 0 : 1 });
      if (!run.miss && it.fog === "all") run.blind = true;
      return finishItem(!run.miss, `${mm.san}. ${run.miss ? "There it is." : "Seen without seeing."}`);
    }
    run.miss = true;
    if (window.Feel) window.Feel.sound("miss");
    if (run.tries >= 2) {
      run.results.push({ rating: it.item.rating, rd: 80, score: 0 });
      $("#calc-board").classList.add("reveal");
      run.board.setArrows([{ from: it.item.ans.slice(0, 2), to: it.item.ans.slice(2, 4), color: "#3d8b6e" }]);
      return finishItem(false, `${it.item.san} was the move. Replay the line once more in your head.`);
    }
    const last = it.item.sans[it.item.sans.length - 1];
    feedback(`Not ${mm.san}. Something moved that you didn't track.`, `Hint: where did ${last} land, and what does it attack now?`);
  }
  // ---- shared feedback / reveal --------------------------------------------------------------
  function feedback(why, hint) {
    run.locked = true;
    const v = view();
    const fb = document.createElement("div");
    fb.className = "ls-feedback"; fb.setAttribute("data-testid", "calc-feedback");
    fb.innerHTML = `<p class="ls-fb-title">Not quite.</p><div class="ls-fb-body"><p data-testid="move-why">${esc(why)}</p><p class="ls-fb-hint">${esc(hint)}</p></div><button type="button" class="primary" id="calc-try">Try again</button>`;
    v.appendChild(fb);
    requestAnimationFrame(() => { if (window.BoardView) window.BoardView.keep(fb); });
    $("#calc-try", fb).addEventListener("click", () => { fb.remove(); run.locked = false; });
  }
  function finishItem(clean, text) {
    run.locked = true;
    if (clean) run.clean++;
    const g = P() ? P().addXp(clean ? 10 : 4, { noHint: clean }) : { gain: 10, mult: 1 };
    run.xp += g.gain; if (g.levelUp) run.levelUp = g.levelUp;
    if (window.Feel) window.Feel.sound(clean ? "good" : "ok");
    const v = view();
    const r = document.createElement("div");
    r.className = "ls-reveal"; r.setAttribute("data-testid", "calc-reveal");
    r.innerHTML = `<p class="ls-rv-title">${clean ? (g.mult > 1 ? "Clean. Combo x" + g.mult : "Clean.") : "Got there."} <span class="ls-xp" data-testid="xp-gain">+${g.gain} XP</span></p><p>${esc(text)}</p><p class="ls-tap">Tap to continue</p>`;
    v.appendChild(r);
    requestAnimationFrame(() => { if (window.BoardView) window.BoardView.keep(r); });
    r.addEventListener("click", () => { run.locked = false; run.i++; render(); });
  }
  function complete() {
    const Pr = P(), s = Pr.get();
    if (run.results.length) { const r = Pr.glicko(s.rating, run.results); r.games = s.rating.games; r.history = (s.rating.history || []).concat([{ at: Date.now(), estimate: r.estimate, rd: r.rd, source: "calc" }]).slice(-200); s.rating = r; }
    s.drills = s.drills || {}; s.drills.calc = (s.drills.calc || 0) + 1;
    Pr.touchDay(Math.max(1, Math.round((Date.now() - run.startedAt) / 60000)));
    Pr.save();
    let badge = null;
    if (run.clean === run.items.length && Pr.badge("calc-clean")) badge = "calc-clean";
    if (run.blind && Pr.badge("blindfold")) badge = badge || "blindfold";
    const next = window.Journey ? window.Journey.nextStep() : null; if (next) Pr.setNext(next);
    const v = view();
    v.innerHTML = `<div class="ls-complete" data-testid="calc-end"><div class="cel-mark">◎</div><h2>${run.clean} of ${run.items.length} clean</h2>
      <p class="end-stat">+${run.xp} XP · Rating ${s.rating.estimate} (estimate)${run.levelUp ? " · ▲ Level " + run.levelUp : ""}</p>
      ${next ? `<button type="button" class="primary" id="calc-next" data-testid="session-next-step">Next: ${esc(next.label)}, ${next.minutes} min</button>` : ""}
      <button type="button" class="${next ? "ghost" : "primary"}" id="calc-again">Another set</button></div>`;
    if (window.Feel) { window.Feel.celebrate("lesson", run.levelUp); if (badge) setTimeout(() => window.Feel.show("badge-unlock", window.Badges ? window.Badges.name(badge) : badge), 500); }
    const n = $("#calc-next", v); if (n) n.addEventListener("click", () => { run = null; next.go(); });
    $("#calc-again", v).addEventListener("click", () => begin());
  }
  window.Calc = {
    load, open: overlayStart, begin, tier, quit,
    current() { const it = run && run.items[run.i]; if (!it) return null; return it.type === "count" ? { type: "count", q: it.q, answer: it.item[it.q].length } : { type: "vis", phase: run.phase, answer: it.item.ans, alternates: it.item.accept, fen: it.item.fen }; }
  };
  window.__qa = window.__qa || {};
  window.__qa.calc = window.Calc;
})();
