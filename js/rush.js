/* Rush: 3 minutes, 3 strikes, CC0 Lichess puzzles that climb from just below your rating. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  let DATA = null, run = null;
  const load = () => DATA ? Promise.resolve(DATA) : fetch("data/lessons/rush.json").then((r) => r.json()).then((d) => (DATA = d));
  function overlayStart() {
    document.querySelectorAll(".overlay.rush-ov").forEach((x) => x.remove());
    const best = window.Progress.get().rush.best;
    const ov = document.createElement("div");
    ov.className = "overlay rush-ov";
    ov.innerHTML = `<div class="ov-card" data-testid="rush-start"><div class="cel-mark">⚡</div><h2>Rush</h2><p class="coach-msg">Three minutes. Three misses and you're out. Puzzles climb as you solve.</p><p class="end-stat">Best: ${best}</p><button type="button" class="primary" id="rush-go">Start Rush</button><button type="button" class="ghost" id="rush-x">Not now</button></div>`;
    document.body.appendChild(ov);
    $("#rush-go", ov).addEventListener("click", () => { ov.remove(); begin(); });
    $("#rush-x", ov).addEventListener("click", () => ov.remove());
    return true;
  }
  function view() {
    let v = document.getElementById("rush-view");
    if (!v) { v = document.createElement("section"); v.id = "rush-view"; v.hidden = true; document.querySelector(".main").appendChild(v); }
    document.querySelectorAll(".main > section").forEach((s) => { s.hidden = s !== v; });
    v.hidden = false;
    return v;
  }
  async function begin() {
    await load();
    const r = window.Progress.get().rating.estimate;
    run = { at: Math.max(0, DATA.puzzles.findIndex((p) => p[2] >= r - 300)), solved: 0, strikes: 0, ends: Date.now() + 180000, results: [], used: new Set() };
    const v = view();
    if (window.AppChrome) { window.AppChrome.setTitle("Rush"); window.AppChrome.setBack(() => end()); }
    v.innerHTML = `<div class="rush"><div class="rush-hud"><span id="rush-time">3:00</span><span id="rush-score">0</span><span id="rush-strikes">○○○</span></div><p class="coach-msg" id="rush-msg">Find the best move.</p><div id="rush-board" class="ls-board"></div></div>`;
    run.board = new BoardUI($("#rush-board", v), { showMaterial: false, onMove, canMove: () => run && !run.lock });
    run.timer = setInterval(tick, 250);
    next();
  }
  function tick() {
    if (!run) return;
    const left = Math.max(0, run.ends - Date.now());
    const t = $("#rush-time"); if (t) t.textContent = Math.floor(left / 60000) + ":" + String(Math.floor(left / 1000) % 60).padStart(2, "0");
    if (!left) end();
  }
  function next() {
    let i = run.at; while (run.used.has(i) && i < DATA.puzzles.length - 1) i++;
    run.used.add(i);
    const [fen, moves, rating] = DATA.puzzles[i];
    const mv = moves.split(" ");
    const c = new Chess(fen); c.move({ from: mv[0].slice(0, 2), to: mv[0].slice(2, 4), promotion: mv[0][4] });
    run.p = { fen: c.fen(), line: mv.slice(1), ply: 0, rating };
    run.board.setFlipped(c.turn() === "b");
    run.board.setPosition(run.p.fen, { from: mv[0].slice(0, 2), to: mv[0].slice(2, 4) });
    run.lock = false;
  }
  function onMove(m) {
    const p = run.p, u = m.from + m.to + (m.promotion || "");
    const c = new Chess(p.fen);
    const mm = c.move({ from: m.from, to: m.to, promotion: m.promotion });
    if (!mm) return;
    if (window.Feel) window.Feel.moved(mm, c);
    if (u !== p.line[p.ply] && !c.in_checkmate()) {
      run.strikes++; run.results.push({ rating: p.rating, rd: 80, score: 0 });
      $("#rush-strikes").textContent = "●".repeat(run.strikes) + "○".repeat(Math.max(0, 3 - run.strikes));
      $("#rush-msg").textContent = "Missed. Best was " + sanOf(p.fen, p.line[p.ply]) + ".";
      if (window.Feel) window.Feel.sound("miss");
      run.lock = true;
      if (run.strikes >= 3) return setTimeout(end, 700);
      run.at += 1; return setTimeout(next, 700);
    }
    p.fen = c.fen(); p.ply++;
    run.board.setPosition(p.fen, { from: m.from, to: m.to });
    if (p.ply >= p.line.length || c.in_checkmate()) {
      run.solved++; run.results.push({ rating: p.rating, rd: 80, score: 1 });
      $("#rush-score").textContent = run.solved; $("#rush-msg").textContent = "Yes. Next.";
      if (window.Feel) window.Feel.sound("good");
      run.at += 3; run.lock = true; return setTimeout(next, 350);
    }
    const rep = p.line[p.ply]; run.lock = true;
    setTimeout(() => { const r = c.move({ from: rep.slice(0, 2), to: rep.slice(2, 4), promotion: rep[4] }); p.fen = c.fen(); p.ply++; run.board.setPosition(p.fen, { from: rep.slice(0, 2), to: rep.slice(2, 4) }); if (window.Feel && r) window.Feel.moved(r, c); run.lock = false; }, 380);
  }
  function sanOf(fen, u) { try { return new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san; } catch (e) { return u; } }
  function end() {
    if (!run) return;
    clearInterval(run.timer);
    const P = window.Progress, s = P.get(), solved = run.solved;
    s.rush.runs++; const isBest = solved > s.rush.best; s.rush.best = Math.max(s.rush.best, solved);
    if (run.results.length) { const r = P.glicko(s.rating, run.results.slice(0, 20)); r.games = s.rating.games; r.history = (s.rating.history || []).concat([{ at: Date.now(), estimate: r.estimate, rd: r.rd, source: "rush" }]); s.rating = r; }
    P.addXp(solved * 4, {}); P.touchDay(3);
    if (solved >= 20 && P.badge("rush-20") && window.Feel) setTimeout(() => window.Feel.show("badge-unlock", "Rush 20"), 400);
    const next = window.Journey ? window.Journey.nextStep() : null; if (next) P.setNext(next);
    run = null;
    const v = document.getElementById("rush-view");
    v.innerHTML = `<div class="ls-complete" data-testid="rush-end"><div class="cel-mark">⚡</div><h2>${solved} solved</h2><p class="end-stat">${isBest ? "New best." : "Best: " + s.rush.best} · Rating ${s.rating.estimate} (estimate)</p>
      ${next ? `<button type="button" class="primary" id="re-next" data-testid="session-next-step">Next: ${next.label}, ${next.minutes} min</button>` : ""}<button type="button" class="ghost" id="re-again">Run it again</button></div>`;
    const n = $("#re-next", v); if (n) n.addEventListener("click", () => next.go());
    $("#re-again", v).addEventListener("click", overlayStart);
  }
  window.Rush = { open: overlayStart, begin, end, load };
})();
