/* 1.6.0 lesson engine. Beats teach, practice repeats, the last stage is a mini-boss.
   You move to answer; taps continue; no Next buttons. Accepted moves are the engine-verified
   set built by tools/lessons/build.mjs, so equal alternatives always count. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const NAME = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
  let DATA = null, loading = null;
  let cur = null; // running lesson state

  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (!loading) loading = fetch("data/lessons/units.json").then((r) => r.json()).then((d) => (DATA = d));
    return loading;
  }
  function allLessons() { return DATA ? DATA.units.flatMap((u) => u.lessons) : []; }
  const EXTRA = {}; // verified content-pack sets, registered at runtime (data only)
  function lessonById(id) { return EXTRA[id] || allLessons().find((l) => l.id === id) || null; }
  function unitOf(id) { return DATA.units.find((u) => u.lessons.some((l) => l.id === id)); }
  function minutes(l) { return Math.max(2, Math.round(((l.stages && l.stages.length) || l.n || 4) * 0.8)); }

  /** Scaled boss: n puzzles nearest the player's rating, easiest first. */
  function bossStages(l) {
    const r = window.Progress ? window.Progress.get().rating.estimate : 1000;
    const target = window.Strength ? window.Strength.bossElo(r) : r + 100;
    const c = (l.candidates || []).slice().sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target)).slice(0, l.n || 4);
    // Warm-up rounds climb toward the boss position, which is the hardest one.
    return c.sort((a, b) => a.rating - b.rating).map((s, i, a) => Object.assign({}, s, { k: i === a.length - 1 ? "boss" : "practice" }));
  }
  function stagesOf(l) { return l.boss ? bossStages(l) : l.stages.map((s, i, a) => (i === a.length - 1 && s.k !== "beat" ? Object.assign({}, s, { k: "boss" }) : s)); }
  const TID = { beat: "lesson-beat", practice: "lesson-practice", boss: "lesson-boss" };

  function uciOf(m) { return m.from + m.to + (m.promotion || ""); }
  function sanOf(fen, uci) { try { const c = new Chess(fen); const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); return m ? m.san : uci; } catch (e) { return uci; } }
  function apply(fen, uci) { const c = new Chess(fen); const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }); return m ? { fen: c.fen(), m, c } : null; }

  // ---- view -----------------------------------------------------------------
  function view() {
    let v = document.getElementById("lesson-view");
    if (!v) { v = document.createElement("section"); v.id = "lesson-view"; v.hidden = true; document.querySelector(".main").appendChild(v); }
    return v;
  }
  function show(v) {
    document.querySelectorAll(".main > section").forEach((s) => { s.hidden = s !== v; });
    v.hidden = false;
  }

  function start(id, opts) {
    opts = opts || {};
    if (!DATA) { load().then(() => start(id, opts)); return true; }
    const l = lessonById(id);
    if (!l) return false;
    const stages = stagesOf(l);
    document.querySelectorAll(".overlay.feel-ov").forEach((x) => x.remove());
    cur = { l, id, stages, i: 0, ply: 0, fen: null, clean: 0, missed: {}, hints: 0, from: opts.from || "train", node: opts.node || null, startedAt: Date.now(), xp: 0 };
    const v = view();
    show(v);
    if (window.AppChrome) { window.AppChrome.setTitle(l.title); window.AppChrome.setBack(() => exit()); }
    renderStage();
    return true;
  }
  function exit() {
    cur = null;
    const back = (window.UI && window.UI._lessonBack) || "train";
    if (window.UI && window.UI.showTab) window.UI.showTab(back);
  }

  function renderStage() {
    const v = view();
    const s = cur.stages[cur.i];
    if (!s) return complete();
    cur.ply = 0; cur.fen = s.fen; cur.hintStep = 0; cur.stageMiss = false; cur.locked = false;
    const tidAttr = cur.placement ? 'data-testid="lesson-placement"' : s.k === "beat" ? 'data-testid="lesson-beat"' : s.k === "boss" ? 'data-testid="lesson-boss"' : 'data-testid="lesson-practice"';
    const dots = cur.stages.map((x, j) => "<i class=\"ls-dot" + (j < cur.i ? " done" : j === cur.i ? " on" : "") + (x.k === "boss" ? " boss" : "") + "\"></i>").join("");
    v.innerHTML =
      "<div class=\"ls-wrap\" " + tidAttr + " data-lesson=\"" + esc(cur.id) + "\" data-unit=\"" + esc(s.unit != null ? s.unit : (cur.l && cur.l.unit)) + "\" data-fen=\"" + esc(s.fen) + "\" data-answer=\"" + esc(s.line[0]) + "\" data-alternates=\"" + esc((s.accept || []).join(",")) + "\">" +
      "<div class=\"ls-top\"><div class=\"ls-dots\">" + dots + "</div>" + (s.k === "boss" ? "<span class=\"chip ls-boss\">Mini-boss</span>" : "") + "</div>" +
      "<p class=\"coach-msg ls-prompt\">" + esc(s.p) + "</p>" +
      "<div id=\"lesson-board\" class=\"ls-board\"></div>" +
      "<div class=\"ls-row\"><span class=\"ls-side\">" + (s.side === "b" ? "Black" : "White") + " to move</span><button type=\"button\" class=\"ghost tiny\" id=\"ls-hint\">Hint</button></div>" +
      "<p class=\"ls-hint-text\" id=\"ls-hint-text\" hidden></p>" +
      "</div>";
    const el = $("#lesson-board", v);
    cur.board = new BoardUI(el, { flipped: s.side === "b", showMaterial: false, onMove: onMove, canMove: () => !cur.locked });
    cur.board.setPosition(s.fen, s.last ? { from: s.last[0], to: s.last[1] } : null);
    if (s.hl) cur.board.setHighlights(s.hl.map((sq) => ({ square: sq, kind: "target" })));
    $("#ls-hint", v).addEventListener("click", hint);
    // Pack positions: lazy engine re-check the first time each one is shown; a failed one is skipped.
    if (s.packItem != null && cur.l.pack && window.Packs) {
      const eng = window.UI && window.UI.hooks && window.UI.hooks.engine && window.UI.hooks.engine();
      const here = cur.i, me = cur;
      window.Packs.recheck(cur.l.pack, s.packItem, eng).then((ok) => { if (!ok && cur === me && cur.i === here) { cur.i++; renderStage(); } });
    }
  }
  // Reveal and feedback panels exist only while shown: no hidden twins in the DOM.
  function panel(kind) {
    const id = kind === "reveal" ? "ls-reveal" : "ls-feedback";
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement("div");
    el.id = id;
    el.className = kind === "reveal" ? "ls-reveal" : "ls-feedback";
    el.setAttribute("data-testid", kind === "reveal" ? "lesson-reveal" : "lesson-feedback");
    if (kind === "reveal") el.addEventListener("click", () => cur && cur.onReveal && cur.onReveal());
    view().appendChild(el);
    // Keep the panel's action above the tab bar on short phones.
    requestAnimationFrame(() => requestAnimationFrame(() => { try { el.scrollIntoView({ block: "nearest" }); } catch (e) {} }));
    return el;
  }
  function expected() {
    const s = cur.stages[cur.i];
    if (cur.ply === 0) return { want: s.line[0], accept: s.accept && s.accept.length ? s.accept : [s.line[0]] };
    const u = s.line[cur.ply];
    return { want: u, accept: cur.ply === 2 && s.accept2 ? s.accept2 : [u] };
  }
  function hint() {
    if (!cur) return;
    const s = cur.stages[cur.i];
    cur.hintStep++; cur.hints++; cur.stageMiss = cur.stageMiss || cur.hintStep >= 2;
    const ex = expected();
    const t = $("#ls-hint-text");
    if (cur.hintStep === 1) { t.hidden = false; t.textContent = s.h || "Checks, captures, threats. In that order."; }
    else if (cur.hintStep === 2) { cur.board.setHighlights((s.hl || []).map((sq) => ({ square: sq, kind: "target" })).concat([{ square: ex.want.slice(0, 2), kind: "hint" }])); t.textContent = "Start with this piece."; }
    else { cur.board.setArrows([{ from: ex.want.slice(0, 2), to: ex.want.slice(2, 4), color: "#d9a441" }]); t.textContent = "Here's the move. Play it."; }
    if (window.Feel) window.Feel.sound("tap");
  }

  function onMove(mv) {
    if (!cur || cur.locked) return;
    const s = cur.stages[cur.i];
    const uci = uciOf(mv);
    const ex = expected();
    const res = apply(cur.fen, uci);
    if (!res) return;
    const ok = ex.accept.includes(uci) || (s.goal && cur.ply === 0 && goalMet(s.goal, res));
    if (window.Feel) window.Feel.moved(res.m, res.c);
    if (!ok) return wrong(s, uci, res, ex);
    cur.fen = res.fen;
    cur.board.setPosition(res.fen, { from: mv.from, to: mv.to });
    cur.board.setArrows([]); cur.board.setHighlights([]);
    // Skill check is a diagnostic: the key first move is the test, so it solves the item.
    if (cur.placement) return finishStage(true);
    // Line continues: show a short reveal while the reply is played, then hand back the board.
    const isMain = uci === s.line[cur.ply];
    if (isMain && s.line.length > cur.ply + 1 && !res.c.game_over()) {
      cur.locked = true;
      const replyUci = s.line[cur.ply + 1];
      const r2 = panel("reveal");
      r2.innerHTML = "<p class=\"ls-rv-title\">Right idea.</p><p>" + esc(sanOf(cur.fen, replyUci)) + " comes back. Finish it.</p>";
      // The reply lands after a beat, or at once if the player taps the panel.
      let replied = false;
      const doReply = () => {
        if (!cur || replied) return;
        replied = true; cur.onReveal = null;
        const r = apply(cur.fen, replyUci);
        if (!r) return finishStage(true);
        cur.fen = r.fen; cur.ply += 2;
        if (cur.ply >= s.line.length || r.c.game_over()) return finishStage(true);
        cur.board.setPosition(r.fen, { from: replyUci.slice(0, 2), to: replyUci.slice(2, 4) });
        if (window.Feel) window.Feel.moved(r.m, r.c);
        const wrap = $(".ls-wrap"); if (wrap) { wrap.setAttribute("data-fen", r.fen); wrap.setAttribute("data-answer", s.line[cur.ply] || ""); wrap.setAttribute("data-alternates", (s.accept2 || []).join(",")); }
        r2.remove(); cur.locked = false;
      };
      cur.onReveal = doReply;
      setTimeout(doReply, 650);
      return;
    }
    // An engine-equal alternate (or the last move of the line) completes the stage.
    finishStage(true);
  }
  function goalMet(goal, res) {
    const m = res.m;
    if (goal.to) return m.to === goal.to && (!goal.piece || m.piece === goal.piece);
    if (goal.capture) return m.to === goal.capture && !!m.captured;
    if (goal.castle) return /[kq]/.test(m.flags);
    if (goal.ep) return m.flags.includes("e");
    if (goal.promote) return m.promotion === goal.promote;
    if (goal.mate) return res.c.in_checkmate();
    return false;
  }

  // ---- why + alternative -----------------------------------------------------
  function whyLocal(s, uci, res, ex) {
    if (s.why && s.why[uci] && cur.ply === 0) {
      // Build-time note "Nd4? Nxd4 is the answer. You're down about 5.8 pawns." reads better as a consequence.
      return s.why[uci].replace(/^(\S+)\? (\S+) is the answer\./, "$1 runs into $2.").replace(/You're (down|up) about/, "You'd be $1 about");
    }
    const c = res.c;
    if (c.in_stalemate()) return "Stalemate: they have no moves and no check. That's a draw.";
    if (s.goal && s.goal.to) return "That lands on " + res.m.to + ". The mark is " + s.goal.to + ".";
    if (s.goal && s.goal.mate && c.in_check()) return "Check, but they can escape. Count the king's exits first.";
    if (s.goal && s.goal.capture) return "Look again: something can be taken on " + s.goal.capture + ".";
    // Did the move leave the moved piece loose?
    try {
      const hung = window.Coach && window.Coach.hangingPieces ? window.Coach.hangingPieces(c, res.m.color) : [];
      const h = hung.find((x) => x.square === res.m.to) || hung.sort((a, b) => b.value - a.value)[0];
      if (h && h.value >= 3) return "That leaves your " + (h.name || NAME[h.piece] || "piece") + " on " + h.square + " loose.";
    } catch (e) {}
    const best = apply(cur.fen, ex.want);
    if (best && best.c.in_checkmate()) return "There was mate here. Check every check first.";
    if (best && best.m.captured && !res.m.captured) return "You left material on the board. Something was free.";
    return "Playable, but it lets them off the hook.";
  }
  function wrong(s, uci, res, ex) {
    cur.locked = true;
    cur.stageMiss = true;
    cur.missed[cur.i] = true;
    cur.board.setPosition(res.fen, { from: uci.slice(0, 2), to: uci.slice(2, 4) });
    if (window.Progress && !cur.placement && !cur.review) window.Progress.addMiss({ fen: cur.fen, uci, best: ex.want, lesson: cur.id });
    if (window.Feel) window.Feel.sound("miss");
    if (cur.placement) return advancePlacement(false);
    const fb = panel("feedback");
    const better = sanOf(cur.fen, ex.want);
    const alts = (ex.accept || []).filter((u) => u !== ex.want).slice(0, 2).map((u) => sanOf(cur.fen, u));
    fb.innerHTML =
      "<p class=\"ls-fb-title\">Not quite.</p>" +
      "<p data-testid=\"move-why\">" + esc(whyLocal(s, uci, res, ex)) + "</p>" +
      (s.h && cur.ply === 0 ? "<p class=\"ls-fb-hint\">Hint: " + esc(s.h) + "</p>" : "") +
      "<p class=\"ls-alt\" data-testid=\"move-alternative\">Engine pick: <b>" + esc(better) + "</b>" + (alts.length ? " (also " + esc(alts.join(", ")) + ")" : "") + "</p>" +
      "<button type=\"button\" class=\"primary\" data-act=\"try\" id=\"ls-try\">Try again</button>";
    $("#ls-try").addEventListener("click", () => {
      fb.remove(); cur.locked = false;
      const prev = cur.ply === 0 ? s.fen : cur.fen;
      cur.board.setPosition(prev, null);
      cur.board.setArrows([{ from: ex.want.slice(0, 2), to: ex.want.slice(2, 4), color: "#3d8b6e" }]);
    });
  }

  function finishStage(ok) {
    const s = cur.stages[cur.i];
    if (cur.placement) return advancePlacement(true);
    const clean = !cur.stageMiss && cur.hintStep < 2;
    if (clean) cur.clean++;
    const xpBase = s.k === "boss" ? 20 : s.k === "practice" ? 10 : 5;
    const g = window.Progress ? window.Progress.addXp(xpBase, { noHint: clean }) : { gain: xpBase, mult: 1 };
    cur.xp += g.gain;
    if (s.rating && cur.l && cur.l.boss && window.Progress) window.Progress.rate(s.rating, clean ? 1 : 0, "boss", { rd: 80 });
    if (window.Feel) { window.Feel.sound(clean ? "good" : "ok"); if (g.levelUp) cur.levelUp = g.levelUp; }
    const r = panel("reveal");
    const deep = s.deep ? "<details class=\"ls-deep\" id=\"ls-deep\"><summary>Go deeper</summary><p>" + esc(s.deep) + "</p></details>" : "";
    r.innerHTML =
      "<p class=\"ls-rv-title\">" + (clean ? (g.mult > 1 ? "Clean. Combo x" + g.mult : "Clean.") : "Got there.") + " <span class=\"ls-xp\" data-testid=\"xp-gain\">+" + g.gain + " XP</span></p>" +
      "<p>" + esc(s.r || "") + "</p>" + deep +
      "<p class=\"ls-tap\">Tap to continue</p>";
    if (s.arrows && s.arrows.length) cur.board.setArrows(s.arrows.slice(0, 1).map((a) => ({ from: a[0], to: a[1], color: "#3d8b6e" })));
    const d = $("#ls-deep");
    if (d) d.addEventListener("toggle", () => { if (d.open && s.arrows) cur.board.setArrows(s.arrows.map((a, j) => ({ from: a[0], to: a[1], color: j % 2 ? "#c45c4a" : "#3d8b6e" }))); });
    cur.onReveal = (e) => { cur.onReveal = null; cur.i++; renderStage(); };
    r.querySelectorAll("details, summary").forEach((x) => x.addEventListener("click", (e) => e.stopPropagation()));
  }

  function complete() {
    if (cur.review) return completeReview();
    const v = view();
    const l = cur.l, n = cur.stages.length;
    const score = n ? cur.clean / n : 1;
    const stars = score >= 0.99 ? 3 : score >= 0.8 ? 2 : score >= 0.5 ? 1 : 0;
    const passed = score >= 0.8;
    const rec = window.Progress ? window.Progress.lessonDone(l.id, score, stars) : { done: passed };
    if (rec.done && window.Journey) window.Journey.completeFromLesson(l.id);
    if (l.boss && window.Progress) {
      const P = window.Progress.get();
      P.bosses.push({ id: l.id, at: Date.now(), rating: P.rating.estimate, score }); window.Progress.save();
    }
    const next = window.Journey ? window.Journey.nextStep(l.id) : null;
    if (next && window.Progress) window.Progress.setNext(next);
    const mins = Math.max(1, Math.round((Date.now() - cur.startedAt) / 60000));
    if (window.Progress) window.Progress.touchDay(mins);
    const star = (k) => "<span class=\"ls-star" + (k < stars ? " on" : "") + "\">★</span>";
    const head = passed ? (l.boss ? "Region test cleared." : "Lesson done.") : "Close. 80% clears it.";
    v.innerHTML =
      "<div class=\"ls-complete\" data-testid=\"lesson-complete\">" +
      (l.boss && passed ? "<div data-testid=\"boss-complete\" class=\"ls-boss-done\">Boss down</div>" : "") +
      "<div class=\"ls-stars\">" + [0, 1, 2].map(star).join("") + "</div>" +
      "<h2>" + esc(head) + "</h2>" +
      "<p class=\"end-stat\">" + cur.clean + " of " + n + " clean · +" + cur.xp + " XP</p>" +
      (cur.levelUp ? "<p class=\"ls-levelup\">▲ Level " + cur.levelUp + "</p>" : "") +
      (passed && next ? "<button type=\"button\" class=\"primary\" id=\"ls-next\" data-testid=\"session-next-step\">Next: " + esc(next.label) + ", " + next.minutes + " min</button>"
        : "<button type=\"button\" class=\"primary\" id=\"ls-again\">Run it again</button>") +
      (passed ? "" : (next ? "<button type=\"button\" class=\"ghost\" id=\"ls-next\" data-testid=\"session-next-step\">Next: " + esc(next.label) + "</button>" : "")) +
      "<button type=\"button\" class=\"ghost\" id=\"ls-done\">Done for now</button>" +
      "</div>";
    if (window.Feel) window.Feel.celebrate(l.boss && passed ? "boss" : passed ? "lesson" : "soft", cur.levelUp);
    const id = l.id, from = cur.from;
    const again = $("#ls-again"); if (again) again.addEventListener("click", () => start(id, { from }));
    const nx = $("#ls-next"); if (nx) nx.addEventListener("click", () => next && next.go && next.go());
    $("#ls-done").addEventListener("click", exit);
  }

  // ---- Train library ----------------------------------------------------------
  function renderHub(root) {
    if (!DATA) { root.innerHTML = "<p class=\"muted\">Loading lessons…</p>"; load().then(() => renderHub(root)); return; }
    const P = window.Progress ? window.Progress.get() : { lessons: {} };
    const r = P.rating ? P.rating.estimate : 1000;
    root.innerHTML = "<div class=\"lesson-hub\" data-testid=\"lesson-hub\">" + DATA.units.map((u) =>
      "<h3 class=\"lh-unit\">" + esc(u.topic) + "</h3><div class=\"lh-grid\">" + u.lessons.map((l) => {
        const done = P.lessons[l.id] && P.lessons[l.id].done;
        const adv = l.tier && l.tier > r ? "<span class=\"lh-tier\">~" + l.tier + "+</span>" : "";
        return "<button type=\"button\" class=\"card-link lesson-card" + (done ? " done" : "") + (l.boss ? " boss" : "") + "\" data-testid=\"lesson-card\" data-lesson=\"" + esc(l.id) + "\" data-unit=\"" + u.id + "\">" +
          "<span class=\"lc-title\">" + esc(l.title) + "</span><span class=\"lc-meta\">" + (done ? "✓ " : "") + minutes(l) + " min" + adv + "</span></button>";
      }).join("") + "</div>").join("") +
      "<button type=\"button\" class=\"ghost lh-check\" data-testid=\"lesson-placement-start\" id=\"lh-check\">Quick skill check (optional)</button></div>";
    root.querySelectorAll("[data-lesson]").forEach((b) => b.addEventListener("click", () => { if (window.UI) window.UI._lessonBack = "train"; start(b.getAttribute("data-lesson"), { from: "train" }); }));
    $("#lh-check", root).addEventListener("click", startPlacement);
  }

  // ---- Review: lesson misses come back as FSRS cards. Two clean reviews in a row retire a mistake. ----
  function reviewDue(at) {
    const P = window.Progress ? window.Progress.get() : null;
    if (!P) return [];
    at = at || Date.now();
    const seen = new Set();
    return (P.misses || []).filter((m) => { if (!m.fen || !m.best || seen.has(m.fen)) return false; seen.add(m.fen); return !m.due || m.due <= at; });
  }
  function stageForMiss(m) {
    const l = lessonById(m.lesson);
    const s = l ? (l.stages || []).concat(l.candidates || []).find((x) => x.fen === m.fen) : null;
    if (s) return Object.assign({}, s, { k: "practice", p: "You missed this one before. " + (s.p || "Find the move.") });
    let side = "w"; try { side = new Chess(m.fen).turn(); } catch (e) { return null; }
    const san = sanOf(m.fen, m.best);
    return { k: "practice", fen: m.fen, side, line: [m.best], accept: [m.best], p: "You missed this one before. Find the move.", h: "Checks, captures, threats. In that order.", r: san + " was the move. Now it's yours." };
  }
  function startReview() {
    if (!DATA) { load().then(startReview); return true; }
    const stages = reviewDue().slice(0, 10).map(stageForMiss).filter(Boolean);
    if (!stages.length) return false;
    document.querySelectorAll(".overlay.feel-ov").forEach((x) => x.remove());
    cur = { l: { id: "review", title: "Review" }, id: "review", review: true, stages, i: 0, ply: 0, fen: null, clean: 0, missed: {}, hints: 0, from: "train", startedAt: Date.now(), xp: 0 };
    const v = view(); show(v);
    if (window.AppChrome) { window.AppChrome.setTitle("Review"); window.AppChrome.setBack(() => exit()); }
    renderStage();
    return true;
  }
  function completeReview() {
    const P = window.Progress, S = P.get(), F = window.SCFSRS;
    let retired = 0;
    cur.stages.forEach((st, i) => {
      const clean = !cur.missed[i];
      S.misses.forEach((m) => {
        if (m.fen !== st.fen) return;
        const c = F ? F.next(m.card || F.newCard(), clean ? 3 : 1) : { due: Date.now() + 86400000 };
        m.card = c; m.due = c.due; m.streak = clean ? (m.streak || 0) + 1 : 0;
      });
    });
    const gone = new Set(S.misses.filter((m) => (m.streak || 0) >= 2).map((m) => m.fen));
    retired = gone.size;
    S.misses = S.misses.filter((m) => !gone.has(m.fen));
    S.retired = (S.retired || 0) + retired;
    P.save();
    P.touchDay(Math.max(1, Math.round((Date.now() - cur.startedAt) / 60000)));
    const next = window.Journey ? window.Journey.nextStep() : null;
    if (next) P.setNext(next);
    const n = cur.stages.length, left = reviewDue(Date.now() + 1).length;
    const v = view();
    v.innerHTML = "<div class=\"ls-complete\" data-testid=\"review-complete\">" +
      "<h2>" + (retired ? retired + " mistake" + (retired > 1 ? "s" : "") + " retired." : "Review done.") + "</h2>" +
      "<p class=\"end-stat\">" + cur.clean + " of " + n + " clean · +" + cur.xp + " XP" + (left ? " · " + left + " still due" : "") + "</p>" +
      (next ? "<button type=\"button\" class=\"primary\" id=\"rv-next\" data-testid=\"session-next-step\">Next: " + esc(next.label) + ", " + next.minutes + " min</button>" : "") +
      "<button type=\"button\" class=\"" + (next ? "ghost" : "primary") + "\" id=\"rv-done\">Done for now</button></div>";
    if (window.Feel) window.Feel.celebrate("lesson");
    const nx = $("#rv-next"); if (nx) nx.addEventListener("click", () => { cur = null; next.go(); });
    $("#rv-done").addEventListener("click", exit);
  }

  // ---- Optional skill check: marks units tested out, never sets the rating -------
  function startPlacement() {
    if (!DATA) { load().then(startPlacement); return true; }
    const items = (DATA.skillCheck || []).filter(Boolean);
    cur = { l: { id: "skill-check", title: "Quick skill check", unit: items[0] && items[0].unit }, id: "skill-check", stages: items.map((s) => Object.assign({}, s, { k: "practice" })), i: 0, placement: true, results: [], clean: 0, missed: {}, xp: 0, startedAt: Date.now() };
    const v = view(); show(v);
    if (window.AppChrome) { window.AppChrome.setTitle("Skill check"); window.AppChrome.setBack(() => exit()); }
    renderStage();
    return true;
  }
  let lastPlacement = null;
  function advancePlacement(ok) {
    const s = cur.stages[cur.i];
    cur.results.push({ unit: s.unit, ok });
    cur.i++;
    // Synchronous: the stage on screen is always the one current() reports. The sound and dots carry the feedback.
    if (cur.i < cur.stages.length) { renderStage(); return; }
    const missed = cur.results.find((x) => !x.ok);
    const units = [...new Set(cur.results.map((x) => x.unit))];
    const startUnit = missed ? missed.unit : 5;
    const testedOut = units.filter((u) => u < startUnit && cur.results.filter((x) => x.unit === u).every((x) => x.ok));
    lastPlacement = { startUnit, firstMissed: missed ? missed.unit : null, testedOut };
    if (window.Progress) { const P = window.Progress.get(); testedOut.forEach((u) => { P.testedOut[u] = true; }); window.Progress.save(); }
    const unitName = (id) => { const u = DATA.units.find((x) => x.id === id); return u ? u.topic : "Endgames"; };
    view().innerHTML =
      "<div class=\"ls-complete\" data-testid=\"lesson-placement-result\" data-start-unit=\"" + startUnit + "\" data-first-missed=\"" + (missed ? missed.unit : "") + "\">" +
      "<h2>Start with " + esc(unitName(startUnit)) + "</h2>" +
      "<p class=\"end-stat\">" + cur.results.filter((x) => x.ok).length + " of " + cur.results.length + " right." + (testedOut.length ? " Tested out of " + testedOut.map(unitName).join(", ") + "." : "") + "</p>" +
      "<p class=\"muted\">This only skips lessons. Your rating comes from games.</p>" +
      "<button type=\"button\" class=\"primary\" id=\"ls-go\">Open " + esc(unitName(startUnit)) + "</button></div>";
    $("#ls-go").addEventListener("click", () => { cur = null; if (window.UI) window.UI.showTab("train"); });
  }

  window.Lessons = {
    load, start, current() {
      if (!cur || !cur.stages || !cur.stages[cur.i]) return null;
      const s = cur.stages[cur.i];
      const ex = expected();
      return { id: cur.id, unit: s.unit != null ? s.unit : cur.l.unit, stage: s.k, index: cur.i, fen: cur.fen, answers: [ex.want], alternates: ex.accept };
    },
    list() { return allLessons().map((l) => ({ id: l.id, unit: l.unit, title: l.title, boss: l.boss || null, tier: l.tier || 0 })); },
    lesson: lessonById, units: () => (DATA ? DATA.units : []), data: () => DATA, minutes,
    openHub() { if (window.UI && window.UI.showTab) window.UI.showTab("lessons"); },
    register(l) { if (l && l.id && Array.isArray(l.stages)) EXTRA[l.id] = l; return l; },
    renderHub, startPlacement, placementResult: () => lastPlacement, exit, startReview, reviewDue: () => reviewDue().length
  };
})();
