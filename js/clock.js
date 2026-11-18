/* 1.6.1 Clock drills (Train): practice deciding under time, not just finding moves.
   - Blitz: 60 seconds, +3 per solve, -5 per miss. Puzzles climb as you solve.
   - Think budget: five positions near your rating, 30 seconds each. Solve inside the budget for full credit.
   Uses the engine-verified Rush puzzles. Feeds the shared rating, XP, combos and badges. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let DATA = null, run = null, mode = "blitz", last = null;
  const MODES = {
    blitz: { label: "Blitz", sub: "60s, +3 per solve", total: 60000, inc: 3000, pen: 5000 },
    budget: { label: "Think budget", sub: "5 positions, 30s each", n: 5, budget: 30000 }
  };
  async function load() {
    if (DATA) return DATA;
    DATA = await fetch("data/lessons/rush.json").then((r) => r.json());
    return DATA;
  }
  const P = () => window.Progress;
  const rating = () => (P() ? P().get().rating.estimate : 1000);
  function view() {
    let v = document.getElementById("clock-view");
    if (!v) { v = document.createElement("section"); v.id = "clock-view"; v.hidden = true; document.querySelector(".main").appendChild(v); }
    document.querySelectorAll(".main > section").forEach((s) => { s.hidden = s !== v; });
    v.hidden = false;
    return v;
  }
  function overlayStart() {
    document.querySelectorAll(".overlay.clock-ov").forEach((x) => x.remove());
    const ov = document.createElement("div");
    ov.className = "overlay clock-ov";
    const pick = () => Object.keys(MODES).map((k) => `<button type="button" class="${k === mode ? "on" : ""}" data-mode="${k}" data-testid="clock-mode">${esc(MODES[k].label)}<span>${esc(MODES[k].sub)}</span></button>`).join("");
    ov.innerHTML = `<div class="ov-card" data-testid="clock-start"><div class="cel-mark">⏱</div><h2>Clock drills</h2><p class="coach-msg">Good moves found too late still lose. Train the deciding part.</p><div class="mode-pick" id="clock-pick">${pick()}</div><button type="button" class="primary" id="clock-go">Start ${esc(MODES[mode].label)}</button><button type="button" class="ghost" id="clock-x">Not now</button></div>`;
    document.body.appendChild(ov);
    const wire = () => ov.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { mode = b.getAttribute("data-mode"); $("#clock-pick", ov).innerHTML = pick(); $("#clock-go", ov).textContent = "Start " + MODES[mode].label; wire(); }));
    wire();
    $("#clock-go", ov).addEventListener("click", () => { ov.remove(); begin(mode); });
    $("#clock-x", ov).addEventListener("click", () => ov.remove());
    return true;
  }
  async function begin(m, opts) {
    await load();
    if (run) clearInterval(run.timer);
    mode = m || mode;
    const M = MODES[mode], r = (opts && opts.rating) || rating();
    const at = Math.max(0, DATA.puzzles.findIndex((p) => p[2] >= r - (mode === "blitz" ? 300 : 100)));
    run = { mode, M, at, used: new Set(), solved: 0, inBudget: 0, n: 0, results: [], xp: 0, startedAt: Date.now(), times: [], ends: mode === "blitz" ? Date.now() + M.total : 0 };
    const v = view();
    if (window.AppChrome) { window.AppChrome.setTitle(M.label); window.AppChrome.setBack(() => end()); }
    v.innerHTML = `<div class="clock" data-testid="clock-run" data-mode="${mode}"><div class="clock-hud"><span id="clock-time" data-testid="clock-time">${mode === "blitz" ? "1:00" : "0:30"}</span><span id="clock-score">0</span></div>
      <div class="clock-bar" id="clock-bar"><i style="width:100%"></i></div>
      <p class="coach-msg" id="clock-msg">${mode === "blitz" ? "Solve fast. Each solve buys three seconds." : "Thirty seconds to decide. Use them, don't waste them."}</p>
      <div id="clock-board" class="ls-board"></div></div>`;
    run.board = new BoardUI($("#clock-board", v), { showMaterial: false, onMove, canMove: () => run && !run.lock });
    run.timer = setInterval(tick, 200);
    next();
    return true;
  }
  const fmt = (ms) => Math.floor(ms / 60000) + ":" + String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  function tick() {
    if (!run) return;
    const bar = $("#clock-bar"), t = $("#clock-time");
    if (run.mode === "blitz") {
      const left = Math.max(0, run.ends - Date.now());
      if (t) t.textContent = fmt(left);
      if (bar) bar.firstChild.style.width = Math.min(100, left / run.M.total * 100) + "%";
      if (!left) end();
    } else if (run.p) {
      const used = Date.now() - run.p.t0, left = run.M.budget - used;
      if (t) t.textContent = left >= 0 ? fmt(left) : "+" + fmt(-left);
      if (bar) { bar.firstChild.style.width = Math.max(0, left / run.M.budget * 100) + "%"; bar.classList.toggle("over", left < 0); }
    }
  }
  function next() {
    if (run.mode === "budget" && run.n >= run.M.n) return end();
    let i = run.at; while (run.used.has(i) && i < DATA.puzzles.length - 1) i++;
    run.used.add(i);
    const [fen, moves, rating] = DATA.puzzles[i];
    const mv = moves.split(" ");
    const c = new Chess(fen); c.move({ from: mv[0].slice(0, 2), to: mv[0].slice(2, 4), promotion: mv[0][4] });
    run.p = { fen: c.fen(), line: mv.slice(1), ply: 0, rating, t0: Date.now(), miss: false };
    run.n++;
    run.board.setFlipped(c.turn() === "b");
    run.board.setPosition(run.p.fen, { from: mv[0].slice(0, 2), to: mv[0].slice(2, 4) });
    const w = $(".clock"); if (w) { w.setAttribute("data-fen", run.p.fen); w.setAttribute("data-answer", run.p.line[0]); }
    run.lock = false;
  }
  /** Timers bound to the current run, so a stale callback never touches the next one. */
  function later(fn, ms) { const r = run; setTimeout(() => { if (run && run === r) fn(); }, ms); }
  function sanOf(fen, u) { try { return new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san; } catch (e) { return u; } }
  function onMove(m) {
    if (!run || !run.p) return;
    const p = run.p, u = m.from + m.to + (m.promotion || "");
    const c = new Chess(p.fen), mm = c.move({ from: m.from, to: m.to, promotion: m.promotion });
    if (!mm) return;
    if (window.Feel) window.Feel.moved(mm, c);
    if (u !== p.line[p.ply] && !c.in_checkmate()) {
      p.miss = true; last = { miss: u, want: p.line[p.ply], fen: p.fen };
      if (window.Feel) window.Feel.sound("miss");
      const best = sanOf(p.fen, p.line[p.ply]);
      run.results.push({ rating: p.rating, rd: 80, score: 0 });
      run.lock = true;
      if (run.mode === "blitz") { run.ends -= run.M.pen; $("#clock-msg").textContent = `Not ${mm.san}: ${best} was it. Minus five seconds.`; run.at += 1; return later(next, 800); }
      $("#clock-msg").textContent = `Not ${mm.san}: ${best} was it. Next one, same budget.`;
      run.times.push(Date.now() - p.t0);
      return later(next, 900);
    }
    p.fen = c.fen(); p.ply++;
    run.board.setPosition(p.fen, { from: m.from, to: m.to });
    if (p.ply >= p.line.length || c.in_checkmate()) return solved();
    const rep = p.line[p.ply]; run.lock = true;
    later(() => { const r = c.move({ from: rep.slice(0, 2), to: rep.slice(2, 4), promotion: rep[4] }); p.fen = c.fen(); p.ply++; run.board.setPosition(p.fen, { from: rep.slice(0, 2), to: rep.slice(2, 4) }); if (window.Feel && r) window.Feel.moved(r, c); run.lock = false; }, 300);
  }
  function solved() {
    const p = run.p, used = Date.now() - p.t0;
    run.solved++; run.times.push(used);
    const inB = run.mode === "budget" ? used <= run.M.budget : true;
    if (inB) run.inBudget++;
    run.results.push({ rating: p.rating, rd: 80, score: inB ? 1 : 0.5 });
    const g = P() ? P().addXp(inB ? 8 : 4, { noHint: inB }) : { gain: 8, mult: 1 };
    run.xp += g.gain; if (g.levelUp) run.levelUp = g.levelUp;
    $("#clock-score").textContent = run.solved;
    if (run.mode === "blitz") { run.ends += run.M.inc; $("#clock-msg").textContent = g.mult > 1 ? `Yes. Combo x${g.mult}. +3 seconds.` : "Yes. +3 seconds."; }
    else $("#clock-msg").textContent = inB ? `Solved in ${Math.round(used / 1000)}s. Inside budget.` : `Solved, ${Math.round((used - run.M.budget) / 1000)}s over. Decide sooner.`;
    if (window.Feel) window.Feel.sound("good");
    run.at += 3; run.lock = true;
    later(next, run.mode === "blitz" ? 300 : 700);
  }
  function end() {
    if (!run) return;
    clearInterval(run.timer);
    const Pr = P(), s = Pr.get();
    if (run.results.length) { const r = Pr.glicko(s.rating, run.results.slice(0, 20)); r.games = s.rating.games; r.history = (s.rating.history || []).concat([{ at: Date.now(), estimate: r.estimate, rd: r.rd, source: "clock" }]).slice(-200); s.rating = r; }
    s.drills = s.drills || {}; s.drills.clock = (s.drills.clock || 0) + 1;
    s.drills.clockBest = Math.max(s.drills.clockBest || 0, run.mode === "blitz" ? run.solved : 0);
    Pr.touchDay(Math.max(1, Math.round((Date.now() - run.startedAt) / 60000)));
    Pr.save();
    let badge = null;
    if (run.mode === "blitz" && run.solved >= 10 && Pr.badge("clock-10")) badge = "clock-10";
    if (run.mode === "budget" && run.n >= run.M.n && run.inBudget === run.M.n && Pr.badge("clock-cool")) badge = "clock-cool";
    const avg = run.times.length ? Math.round(run.times.reduce((a, b) => a + b, 0) / run.times.length / 1000) : 0;
    const next = window.Journey ? window.Journey.nextStep() : null; if (next) Pr.setNext(next);
    const r0 = run; run = null;
    const v = view();
    const head = r0.mode === "blitz" ? `${r0.solved} solved` : `${r0.inBudget} of ${r0.M.n} in budget`;
    v.innerHTML = `<div class="ls-complete" data-testid="clock-end"><div class="cel-mark">⏱</div><h2>${head}</h2>
      <p class="end-stat">Average ${avg}s a move · +${r0.xp} XP · Rating ${s.rating.estimate} (estimate)${r0.levelUp ? " · ▲ Level " + r0.levelUp : ""}</p>
      ${next ? `<button type="button" class="primary" id="clock-next" data-testid="session-next-step">Next: ${esc(next.label)}, ${next.minutes} min</button>` : ""}
      <button type="button" class="${next ? "ghost" : "primary"}" id="clock-again">Run it again</button></div>`;
    if (window.Feel) { window.Feel.celebrate("lesson", r0.levelUp); if (badge) setTimeout(() => window.Feel.show("badge-unlock", window.Badges ? window.Badges.name(badge) : badge), 500); }
    const n = $("#clock-next", v); if (n) n.addEventListener("click", () => next.go());
    $("#clock-again", v).addEventListener("click", overlayStart);
  }
  window.Clock = { lastMiss: () => last, load, open: overlayStart, begin, end, MODES, current() { return run && run.p ? { mode: run.mode, fen: run.p.fen, answer: run.p.line[run.p.ply], solved: run.solved } : null; } };
  window.__qa = window.__qa || {};
  window.__qa.clock = window.Clock;
})();
