/* Think With Me: scan → threats → candidates → plan → check → move → play it out.
   Modes: watch, help, alone. Each step advances on a board or chip action, never a Next button.
   Claims are checked against the engine. Hint ladder: nudge, idea, move. */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const BEAT = 600;
  const ARROW_COLORS = ["#e0a100", "#56b4e9", "#cc79a7"];

  const STARTERS = [
    { id: "legal", fen: "r2qkbnr/ppp2ppp/2np4/4N3/2B1P3/2N5/PPPP1PPP/R1BQK2R w KQkq - 2 6", color: "white", title: "A classic centre attack" },
    { id: "fork", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", color: "white", title: "Develop and look for a fork" },
    { id: "backrank", fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", color: "white", title: "The open file" }
  ];

  const STEPS = ["scan", "threats", "candidates", "plan", "check", "move"];

  function shortClaim(s) {
    return window.Practice && window.Practice.words8 ? window.Practice.words8(s, 88) : String(s || "");
  }

  async function engineView(engine, fen) {
    if (!engine || !engine.analyze) return null;
    try {
      if (window.SCAccount && window.SCAccount.pauseAnalysis) window.SCAccount.pauseAnalysis();
      return await engine.analyze(fen, { movetime: 220, depth: 12, multipv: 3 });
    } catch (e) { return null; }
    finally {
      if (window.SCAccount && window.SCAccount.resumeAnalysis) window.SCAccount.resumeAnalysis(engine);
    }
  }

  function sanOf(fen, uci) {
    try {
      const c = new Chess(fen);
      const mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" });
      return mv ? mv.san : uci;
    } catch (e) { return uci; }
  }

  function hanging(fen, forColor) {
    if (!window.Coach || !window.Coach.hangingPieces) return [];
    try { return window.Coach.hangingPieces(new Chess(fen), forColor) || []; } catch (e) { return []; }
  }

  function kingSquare(chess, color) {
    const b = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = b[r][f];
        if (p && p.type === "k" && p.color === color) return "abcdefgh"[f] + (8 - r);
      }
    }
    return null;
  }

  function tacticalSquares(fen, color) {
    const ch = new Chess(fen);
    const us = color === "black" ? "b" : "w";
    const them = us === "w" ? "b" : "w";
    const squares = {};
    function add(sq, kind) {
      if (!sq) return;
      if (!squares[sq]) squares[sq] = kind;
    }
    hanging(fen, us).forEach((h) => add(h.square, "hang"));
    hanging(fen, them).forEach((h) => add(h.square, "take"));
    try {
      ch.moves({ verbose: true }).forEach((m) => {
        if (m.captured) add(m.to, "take");
        if (m.san.indexOf("+") >= 0 || m.san.indexOf("#") >= 0) {
          add(m.to, "hint");
          add(m.from, "hint");
        }
      });
      if (ch.in_check()) add(kingSquare(ch, us), "check");
    } catch (e) {}
    return squares;
  }

  function threatSquares(fen, color) {
    const us = color === "black" ? "b" : "w";
    const them = us === "w" ? "b" : "w";
    const ours = hanging(fen, us);
    const theirs = hanging(fen, them);
    const squares = {};
    (ours.length ? ours : theirs).forEach((h) => { squares[h.square] = ours.length ? "hang" : "take"; });
    return squares;
  }

  function applyUci(fen, uci) {
    const c = new Chess(fen);
    const mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" });
    return mv ? c.fen() : null;
  }

  function buildScript(fen, color, res) {
    const us = color === "black" ? "b" : "w";
    const them = us === "w" ? "b" : "w";
    const pvs = (res && res.pvs) || [];
    const cands = pvs.slice(0, 3).map((p, i) => {
      const uci = p.pv && p.pv[0];
      return {
        uci, san: uci ? sanOf(fen, uci) : "?",
        score: p.score, isMate: p.isMate,
        color: ARROW_COLORS[i % ARROW_COLORS.length],
        ok: i === 0 || (!p.isMate && !pvs[0].isMate && Math.abs((pvs[0].score || 0) - (p.score || 0)) <= 80)
      };
    }).filter((c) => c.uci);
    if (cands[0]) cands[0].ok = true;
    const best = cands[0];
    const ourHang = hanging(fen, us);
    const theirHang = hanging(fen, them);
    const scanMap = tacticalSquares(fen, color);
    const threatMap = threatSquares(fen, color);
    let hangAfter = [];
    if (best) {
      const after = applyUci(fen, best.uci);
      if (after) hangAfter = hanging(after, us);
    }
    const scan = "Tap the checks, captures, or loose pieces.";
    let threats = "No immediate hang. Tap a loose piece if you see one, or wait.";
    if (ourHang.length) threats = "Tap the piece of yours that’s under fire.";
    else if (theirHang.length) threats = "Tap the loose piece you can take.";
    const candText = "Tap the arrow you want to look at.";
    const planChips = [];
    if (best) {
      planChips.push({ id: "best", label: best.isMate ? "Go for mate with " + best.san : "Play " + best.san + " and stay consistent.", ok: true });
      cands.slice(1).forEach((c, i) => {
        planChips.push({ id: "alt-" + i, label: "Play " + c.san + " instead.", ok: !!c.ok });
      });
    }
    if (planChips.length < 2) {
      planChips.push({ id: "decoy", label: "Push a wing pawn and wait.", ok: false });
    }
    const plan = "Pick the plan that wins out.";
    const check = hangAfter.length
      ? "After the plan, something may hang. Tap that piece."
      : "After the plan, is anything loose? Tap “It’s safe” if not.";
    const move = best ? "Play " + best.san + " on the board." : "Play the move you chose.";
    return {
      fen, color, best, cands, ourHang, theirHang, hangAfter,
      scanMap, threatMap, planChips,
      claims: { scan, threats, candidates: candText, plan, check, move },
      verified: !!(res && best)
    };
  }

  function start(root, opts) {
    opts = opts || {};
    const engine = opts.engine;
    const mode = opts.mode === "alone" ? "alone" : opts.mode === "watch" ? "watch" : "help";
    const pos = opts.pos || STARTERS[0];
    const fen = pos.fen;
    const color = pos.color || pos.side || "white";
    let script = null;
    let stepI = 0;
    let hint = 0;
    let locked = false;
    let done = false;

    root.innerHTML =
      "<div class=\"op-page think-page compact-lesson\">" +
      "<div id=\"th-board\" class=\"mini-board\"></div>" +
      "<p class=\"cue-bar\" id=\"th-cue\">Checking this with the engine…</p>" +
      "<div id=\"th-why\" class=\"why-panel\" hidden></div>" +
      "<div id=\"th-choices\" class=\"choices\"></div>" +
      "<div class=\"nav-row\" id=\"th-nav\"></div>" +
      "</div>";
    if (window.AppChrome) {
      window.AppChrome.setTitle("Think With Me");
      window.AppChrome.setBack(opts.onBack || null);
    }

    const board = new window.BoardUI($("#th-board", root), {
      flipped: color === "black",
      showMaterial: false,
      canMove: function () { return !locked && !done && script && STEPS[stepI] === "move"; },
      onMove: function (spec) {
        if (!script || !script.best || STEPS[stepI] !== "move" || locked) return;
        const uci = (spec.from + spec.to + (spec.promotion || "")).toLowerCase();
        if (uci === script.best.uci) advanceCorrect();
        else miss("That’s not it. Try the board again, or take a nudge.");
      },
      onSquare: function (sq) { onBoardTap(sq); },
      onArrow: function (a) { onArrow(a); }
    });
    board.setPosition(fen);

    function setCue(text, why) {
      const cue = $("#th-cue", root);
      const whyBox = $("#th-why", root);
      const line = shortClaim(text);
      cue.innerHTML = esc(line) + (why && why !== line ? " <button type=\"button\" class=\"text-btn why-btn\" id=\"th-why-btn\">Why?</button>" : "");
      whyBox.hidden = true;
      whyBox.textContent = why || "";
      const btn = $("#th-why-btn", root);
      if (btn) btn.addEventListener("click", function () { whyBox.hidden = !whyBox.hidden; });
    }

    function showNav(buttons) {
      const nav = $("#th-nav", root);
      nav.innerHTML = (buttons || []).map(function (b) {
        return "<button type=\"button\" class=\"btn" + (b.primary ? " primary" : "") + "\" data-act=\"" + b.act + "\">" + esc(b.label) + "</button>";
      }).join("");
      nav.querySelectorAll("[data-act]").forEach(function (el) {
        el.addEventListener("click", function () { handle(el.getAttribute("data-act")); });
      });
    }

    function hintButtons() {
      if (mode === "watch" || done) return [];
      if (hint < 1) return [{ act: "nudge", label: "Nudge" }];
      if (hint < 2) return [{ act: "idea", label: "Idea" }];
      if (hint < 3) return [{ act: "show-move", label: "Show the move" }];
      return [];
    }

    function paintScan(map) {
      const hi = Object.keys(map || {}).map(function (sq) { return { square: sq, kind: map[sq] || "hint" }; });
      if (board.setHighlights) board.setHighlights(hi);
    }

    function paintCands(emphasize) {
      const arrows = (script.cands || []).map(function (c) {
        const dim = emphasize && c.uci !== emphasize;
        return { from: c.uci.slice(0, 2), to: c.uci.slice(2, 4), color: c.color, opacity: dim ? 0.35 : 0.95, uci: c.uci };
      });
      if (board.setArrows) board.setArrows(arrows);
    }

    function renderStep() {
      if (!script || done) return;
      const key = STEPS[stepI];
      setCue(script.claims[key], script.claims[key]);
      const box = $("#th-choices", root);
      box.innerHTML = "";
      if (board.setArrows) board.setArrows([]);
      if (board.setHighlights) board.setHighlights([]);

      if (key === "scan") {
        paintScan(hint ? script.scanMap : {});
        if (mode === "watch") { paintScan(script.scanMap); autoAdvanceIfEmptyOrWatch(script.scanMap); }
        else if (!Object.keys(script.scanMap).length) autoAdvanceIfEmptyOrWatch(script.scanMap);
      } else if (key === "threats") {
        paintScan(hint ? script.threatMap : {});
        if (mode === "watch") { paintScan(script.threatMap); autoAdvanceIfEmptyOrWatch(script.threatMap); }
        else if (!Object.keys(script.threatMap).length) autoAdvanceIfEmptyOrWatch(script.threatMap);
      } else if (key === "candidates") {
        paintCands(hint >= 3 && script.best ? script.best.uci : null);
        if (mode === "watch") { paintCands(script.best && script.best.uci); scheduleAdvance(); }
      } else if (key === "plan") {
        script.planChips.forEach(function (chip) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "choice";
          b.textContent = chip.label;
          b.addEventListener("click", function () {
            if (locked || done) return;
            if (chip.ok) { b.classList.add("on"); advanceCorrect(); }
            else miss("Not that plan. Pick the one that stays consistent.");
          });
          box.appendChild(b);
        });
        if (mode === "watch") scheduleAdvance();
      } else if (key === "check") {
        if (script.hangAfter.length) {
          paintScan(script.hangAfter.reduce(function (m, h) { m[h.square] = "hang"; return m; }, {}));
        } else {
          const safe = document.createElement("button");
          safe.type = "button";
          safe.className = "choice";
          safe.textContent = "It’s safe";
          safe.addEventListener("click", function () { if (!locked) advanceCorrect(); });
          box.appendChild(safe);
        }
        if (mode === "watch") scheduleAdvance();
      } else if (key === "move") {
        if (hint >= 3 && script.best) {
          paintCands(script.best.uci);
          if (board.setHighlights) board.setHighlights([
            { square: script.best.uci.slice(0, 2), kind: "hint" },
            { square: script.best.uci.slice(2, 4), kind: "key" }
          ]);
        }
        if (mode === "watch") scheduleAdvance();
      }
      showNav(hintButtons());
    }

    function autoAdvanceIfEmptyOrWatch(map) {
      if (mode === "watch") { scheduleAdvance(); return; }
      if (!Object.keys(map || {}).length) scheduleAdvance();
    }

    function scheduleAdvance() {
      if (locked || done) return;
      locked = true;
      setTimeout(function () { locked = false; goNext(true); }, BEAT + (mode === "watch" ? 400 : 0));
    }

    function advanceCorrect() {
      if (locked || done) return;
      locked = true;
      const boardEl = $("#th-board", root);
      if (boardEl) boardEl.classList.add("th-ok");
      setTimeout(function () {
        if (boardEl) boardEl.classList.remove("th-ok");
        locked = false;
        goNext(true);
      }, BEAT);
    }

    function miss(msg) {
      const boardEl = $("#th-board", root);
      if (boardEl) {
        boardEl.classList.remove("shake");
        void boardEl.offsetWidth;
        boardEl.classList.add("shake");
      }
      if (window.Sound && window.Sound.warn) window.Sound.warn();
      setCue(msg || "Not that one. Try again, or take a nudge.", script.claims[STEPS[stepI]]);
      showNav(hintButtons());
    }

    function onBoardTap(sq) {
      if (!script || locked || done) return;
      const key = STEPS[stepI];
      if (key === "scan") {
        if (script.scanMap[sq]) { paintScan(script.scanMap); advanceCorrect(); }
        else miss("Look at checks, captures, and loose pieces.");
        return;
      }
      if (key === "threats") {
        if (script.threatMap[sq]) { paintScan(script.threatMap); advanceCorrect(); }
        else if (!Object.keys(script.threatMap).length) advanceCorrect();
        else miss("Tap the piece that’s actually under fire.");
        return;
      }
      if (key === "candidates") {
        const hit = (script.cands || []).find(function (c) { return c.uci.slice(0, 2) === sq || c.uci.slice(2, 4) === sq; });
        if (hit) { paintCands(hit.uci); advanceCorrect(); }
        else miss("Tap one of the arrows.");
        return;
      }
      if (key === "check") {
        const hang = script.hangAfter.map(function (h) { return h.square; });
        if (hang.length && hang.indexOf(sq) >= 0) advanceCorrect();
        else if (!hang.length) miss("Nothing hangs — tap “It’s safe.”");
        else miss("Tap the piece that would be loose.");
      }
    }

    function onArrow(a) {
      if (!script || locked || done || STEPS[stepI] !== "candidates") return;
      const uci = a && (a.uci || (a.from + a.to));
      const hit = (script.cands || []).find(function (c) { return c.uci === uci; });
      if (hit) { paintCands(hit.uci); advanceCorrect(); }
    }

    function goNext(ok) {
      if (done) return;
      if (stepI < STEPS.length - 1) {
        stepI++;
        hint = 0;
        renderStep();
        return;
      }
      finishMove(ok);
    }

    function finishMove(ok) {
      done = true;
      locked = false;
      setCue(ok ? "That’s the move." : ("The move is " + (script.best && script.best.san) + "."), script.claims.plan);
      if (script.best) {
        try {
          const c = new Chess(fen);
          c.move({ from: script.best.uci.slice(0, 2), to: script.best.uci.slice(2, 4), promotion: script.best.uci[4] || "q" });
          board.setPosition(c.fen(), { from: script.best.uci.slice(0, 2), to: script.best.uci.slice(2, 4) });
        } catch (e) {}
      }
      showNav([
        { act: "playout", label: "Play it out", primary: true },
        { act: "again", label: "Again" },
        { act: "done", label: "Done" }
      ]);
      if (window.SCAccount) {
        if (window.SCAccount.markTodayDone) window.SCAccount.markTodayDone();
        else if (window.SCAccount.getProgress) {
          window.SCAccount.getProgress().then(function (p) {
            p.thinkDone = (p.thinkDone || 0) + 1;
            window.SCAccount.setProgress(p);
          });
        }
      }
    }

    function handle(act) {
      if (act === "nudge") {
        hint = 1;
        setCue("Look at checks, captures, and loose pieces.", script.claims.scan);
        if (STEPS[stepI] === "scan") paintScan(script.scanMap);
        if (STEPS[stepI] === "threats") paintScan(script.threatMap);
        showNav(hintButtons());
        return;
      }
      if (act === "idea") {
        hint = 2;
        setCue(script.claims.plan, script.claims.candidates);
        if (STEPS[stepI] === "candidates" || STEPS[stepI] === "move") paintCands(script.best && script.best.uci);
        showNav(hintButtons());
        return;
      }
      if (act === "show-move") {
        hint = 3;
        renderStep();
        return;
      }
      if (act === "playout" && opts.playFromFen) {
        opts.playFromFen({ fen: fen, color: color, note: "Play it out. Keep the plan." });
        return;
      }
      if (act === "again") {
        stepI = 0; hint = 0; locked = false; done = false;
        board.setPosition(fen);
        renderStep();
        return;
      }
      if (act === "done") {
        if (opts.onFinished) opts.onFinished();
        else if (opts.onBack) opts.onBack();
      }
    }

    (async function () {
      const res = await engineView(engine, fen);
      script = buildScript(fen, color, res);
      if (!script.verified) setCue("Engine still warming. Scan the board anyway.", script.claims.scan);
      renderStep();
    })();
  }

  window.SCThink = { start, starters: STARTERS, steps: STEPS };
})();
