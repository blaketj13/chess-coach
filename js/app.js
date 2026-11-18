(function () {
  const APP_VERSION = "1.6.1";
  window.APP_VERSION = APP_VERSION;
  window.APP_VERSION = APP_VERSION;

  function notifyAndroidEngine(ok, why) {
    try {
      if (typeof window.SparringCoachAndroid === "undefined" || !window.SparringCoachAndroid) return;
      if (ok && window.SparringCoachAndroid.engineReady) window.SparringCoachAndroid.engineReady();
      else if (!ok && window.SparringCoachAndroid.engineFailed) window.SparringCoachAndroid.engineFailed(String(why || "failed"));
    } catch (e) {}
  }

  const $ = (sel) => document.querySelector(sel);

  const state = {
    mode: "hints", // hints | warn | off
    opponentId: "fianchetto-grinder",
    playAs: "white",
    chess: new Chess(),
    history: [],
    uciHistory: [],
    engine: null,
    engineReady: false,
    playSearch: { movetime: 250, depth: 12 },
    thinking: false,
    pending: null,
    books: null,
    vsBooks: null,
    leftTheory: false,
    log: [],
    evalCp: null,
    over: false,
    bookHits: 0,
    bookPlies: 0,
    lastCueId: null,
  };

  function profile() {
    const base = window.PROFILES[state.opponentId] || window.PROFILES["solid-defender"];
    if (!state.bot) return base;
    return Object.assign({}, base, { shortName: state.bot.name || base.shortName, elo: state.bot.rating });
  }
  function botColor() {
    return state.playAs === "white" ? "b" : "w";
  }
  function blakeColor() {
    return state.playAs === "white" ? "w" : "b";
  }
  function status(msg) {
    const el = $("#status");
    if (el) el.textContent = msg;
  }
  function setEngineLabel(text, ok) {
    const el = $("#engine-state");
    if (!el) return;
    const failed = /fail/i.test(text || "");
    el.textContent = "";
    el.className = "engine-dot" + (ok ? " ready" : failed ? " failed" : " warming");
    el.title = text || "";
    el.setAttribute("aria-label", text || "Engine");
  }
  function setPhase() {
    const el = $("#phase-badge");
    if (el && window.Coach) {
      try { el.textContent = window.Coach.gamePhase(state.chess); } catch (e) { el.textContent = ""; }
    }
  }
  function setLineBadge(text) {
    const el = $("#line-badge");
    if (el) el.textContent = text || "";
  }

  async function loadBooks() {
    const base = new URL(".", document.baseURI || location.href);
    const books = await fetch(new URL("data/books.json", base)).then((r) => r.json());
    state.books = books;
    state.vsBooks = {};
  }

  function weightedPick(map) {
    const entries = Object.keys(map).map((k) => [k, map[k]]);
    const total = entries.reduce((s, e) => s + e[1], 0);
    if (!total) return null;
    let r = Math.random() * total;
    for (const [m, w] of entries) {
      r -= w;
      if (r <= 0) return m;
    }
    return entries[entries.length - 1][0];
  }

  function bookMoveForBot() {
    const color = botColor() === "w" ? "white" : "black";
    const prefix = state.uciHistory.join(" ");
    const vs = state.vsBooks && state.vsBooks[state.opponentId] && state.vsBooks[state.opponentId][color];
    const all = state.books && state.books[state.opponentId] && state.books[state.opponentId][color];
    if (vs && vs[prefix] && Object.keys(vs[prefix]).length) return weightedPick(vs[prefix]);
    if (all && all[prefix] && Object.keys(all[prefix]).length) return weightedPick(all[prefix]);
    return null;
  }

  function bookMoveForBotPreview() {
    const color = botColor() === "w" ? "white" : "black";
    const prefix = state.uciHistory.join(" ");
    const vs = state.vsBooks && state.vsBooks[state.opponentId] && state.vsBooks[state.opponentId][color];
    const all = state.books && state.books[state.opponentId] && state.books[state.opponentId][color];
    const table = (vs && vs[prefix]) || (all && all[prefix]);
    return table && Object.keys(table).length ? table : null;
  }

  function uciToMove(chess, uci) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    return chess.move({ from: from, to: to, promotion: promotion || "q" });
  }

  function scoreToCp(pv, forColor, sideToMove) {
    if (!pv) return 0;
    let s;
    if (pv.isMate) {
      const m = pv.score;
      s = m === 0 ? 0 : (m > 0 ? 10000 - m : -10000 - m);
    } else {
      s = pv.score;
    }
    if (sideToMove !== forColor) s = -s;
    return s;
  }

  function hangingCaptureAmong(chess, pvs, botCol) {
    const hung = window.Coach.hangingPieces(chess, botCol === "w" ? "b" : "w").filter((h) => h.value >= 3);
    if (!hung.length) return null;
    const squares = new Set(hung.map((h) => h.square));
    for (const pv of pvs) {
      const uci = pv.pv && pv.pv[0];
      if (!uci) continue;
      const to = uci.slice(2, 4);
      if (squares.has(to)) return uci;
    }
    return null;
  }

  async function chooseEngineMove() {
    const fen = state.chess.fen();
    const p = profile();
    if (window.SCAccount && window.SCAccount.pauseAnalysis) window.SCAccount.pauseAnalysis();
    try {
      // Humanlike strength by rating (js/strength.js): sampling + plausible misses below 1500, UCI_Elo above. No random blunders.
      return await window.Strength.pick(state.engine, fen, state.bot ? state.bot.rating : p.elo, p.style);
    } finally {
      if (window.SCAccount && window.SCAccount.resumeAnalysis) window.SCAccount.resumeAnalysis(state.engine);
    }
  }

  /** Placement games stop at a soft move cap; the engine scores the position. */
  async function adjudicate() {
    try {
      const res = await state.engine.analyze(state.chess.fen(), { movetime: 400, multipv: 1 });
      const pv = res.pvs && res.pvs[0];
      let cp = pv ? (pv.isMate ? (pv.score > 0 ? 5000 : -5000) : pv.score) : 0;
      if (state.chess.turn() !== blakeColor()) cp = -cp;
      return cp >= 200 ? "win" : cp <= -200 ? "loss" : "draw";
    } catch (e) { return "draw"; }
  }
  async function capReached() {
    if (!state.bot || !state.bot.moveCap || state.over) return false;
    if (state.history.length < state.bot.moveCap * 2) return false;
    const r = await adjudicate();
    endGame(r, "Move cap reached. The engine scores it: " + (r === "win" ? "you're better." : r === "loss" ? "they're better." : "about even."));
    return true;
  }

  async function refreshEval() {
    if (!state.engineReady) return;
    try {
      const res = await state.engine.analyze(state.chess.fen(), { movetime: 220, multipv: 1 });
      if (res.pvs && res.pvs[0]) {
        state.evalCp = scoreToCp(res.pvs[0], blakeColor(), state.chess.turn());
      }
    } catch (e) {
      console.warn("eval failed", e);
    }
  }

  function renderCoachStart() {
    const p = profile();
    const box = $("#opening-plan");
    if (box) box.innerHTML = "";
    const stream = $("#coach-stream");
    if (stream) stream.innerHTML = "";
    showToast("info", "You're " + (state.playAs === "black" ? "Black" : "White") + " vs " + (p.shortName || p.name) + ".");
    if ($("#postgame")) $("#postgame").hidden = true;
    hideTakeback();
    setPhase();
    setLineBadge("");
  }

  function oneLine(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    const w = t.split(" ").filter(Boolean);
    return w.length <= 12 ? t : w.slice(0, 12).join(" ") + "…";
  }
  let toastTimer = null;
  function showToast(kind, text) {
    const el = $("#wes-toast");
    const tx = $("#wes-toast-text");
    if (!el || !tx || !text) return;
    tx.textContent = oneLine(text);
    el.hidden = false;
    el.className = "wes-toast " + (kind || "");
    el.onclick = function () {
      tx.textContent = text;
      el.onclick = null;
    };
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (el) el.hidden = true; }, 4500);
  }
  function pushCoach(kind, text) {
    const stream = $("#coach-stream");
    if (stream && text) {
      const div = document.createElement("div");
      div.className = "coach-msg " + kind;
      div.textContent = text;
      stream.prepend(div);
      while (stream.children.length > 8) stream.removeChild(stream.lastChild);
    }
    if (text) showToast(kind, text);
    if (kind === "warn" && window.Sound) window.Sound.warn();
    else if (kind === "tip" && window.Sound && window.Sound.voice) window.Sound.speak(text);
  }
  function currentOpponent() {
    const sel = $("#opp-select");
    return (sel && sel.value) || state.opponentId;
  }
  function showGameUI() {
    if (window.UI && window.UI.showTab) window.UI.showTab("play");
    const lobby = $("#lobby");
    const game = $("#game-ui");
    if (lobby) lobby.hidden = true;
    if (game) game.hidden = false;
  }
  function showLobby() {
    const lobby = $("#lobby");
    const game = $("#game-ui");
    if (lobby) lobby.hidden = false;
    if (game) game.hidden = true;
    const play = $("#play-view");
    if (window.AppChrome && play && !play.hidden) {
      window.AppChrome.setTitle("Play");
      window.AppChrome.setBack(null);
    }
  }

  function hideTakeback() {
    const bar = $("#takeback-bar");
    if (bar) bar.hidden = true;
    const best = $("#best-reveal");
    if (best) { best.hidden = true; best.textContent = ""; }
  }

  function maybeLeaveTheory() {
    if (state.leftTheory) return;
    if (!bookMoveForBotPreview()) {
      state.leftTheory = true;
      if (state.mode !== "off") {
        const note = window.Openings && window.Openings.leftBookNote
          ? window.Openings.leftBookNote(state.uciHistory, state.playAs)
          : null;
        pushCoach("principle", (note && note.text) || (window.Coach.pickPrinciple && window.Coach.pickPrinciple()) ||
          "He's left the book. Stick to the ideas: develop, castle, and keep the plan.");
      }
    }
  }

  function applyMove(moveObj) {
    const mv = state.chess.move(moveObj);
    if (!mv) return null;
    const uci = mv.from + mv.to + (mv.promotion || "");
    state.uciHistory.push(uci);
    state.history.push(mv);
    window.board.setPosition(state.chess.fen(), { from: mv.from, to: mv.to });
    window.board.setHighlights([]);
    if (window.board.setArrows) window.board.setArrows([]);
    if (window.Feel) { try { window.Feel.moved(mv, state.chess); } catch (e) { console.warn(e); } }
    else if (window.Sound) { if (mv.captured) window.Sound.capture(); else window.Sound.move(); }
    setPhase();
    return mv;
  }

  function gameEnded() {
    try {
      if (state.chess.in_checkmate()) return state.chess.turn() === blakeColor() ? "loss" : "win";
      if (state.chess.in_stalemate()) return "draw";
      if (state.chess.in_threefold_repetition()) return "draw";
      if (state.chess.insufficient_material()) return "draw";
      if (state.chess.in_draw()) return "draw";
    } catch (e) { console.warn("gameEnded failed", e); }
    return null;
  }

  function endGame(result, reason) {
    state.over = true;
    state.thinking = false;
    // Badges come from real games only.
    if (window.Badges && state.history.length >= 6) {
      try { window.Badges.fromGame(state.history, blakeColor(), result, { fen: state.startFen || undefined }); } catch (e) { console.warn(e); }
    }
    const onEnd = state.onEnd;
    if (onEnd) {
      state.onEnd = null; state.bot = null;
      status(reason || "Game over");
      if (window.Progress) window.Progress.touchDay(4);
      setTimeout(() => { try { onEnd(result); } catch (e) { console.error(e); } }, 600);
      return;
    }
    if (window.Progress && state.history.length >= 10) {
      const p = profile();
      window.Progress.rate(p.elo, result === "win" ? 1 : result === "draw" ? 0.5 : 0, "spar");
      window.Progress.touchDay(4);
    }
    hideTakeback();
    status(reason || (result === "win" ? "You won" : result === "loss" ? "You lost" : "Draw"));
    const moments = state.log.filter((ev) => ev.severe || ev.type === "eval_drop" || ev.type === "hung_piece" || ev.drop >= 150);
    const top = moments.slice(-6).reverse().slice(0, 3);
    const lines = [];
    lines.push(result === "win" ? "You won this game." : result === "loss" ? "The bot won this game." : "The game was a draw.");
    lines.push("The bot followed " + state.bookHits + " of its own opening moves before leaving the book.");
    const hung = state.log.filter((e) => e.type === "hung_piece" || (e.type === "eval_drop" && /queen|rook|knight|bishop/.test(e.text || ""))).length;
    if (top.length) lines.push("Here are the three moments most worth a second look. You can replay any of them from the position before the move.");
    else lines.push("Clean game. No big slips. Keep the habit: their threat, your loose pieces, theirs.");

    const box = $("#postgame");
    box.hidden = false;
    box.innerHTML = "<h3>After the game</h3>" + lines.map((l) => "<p>" + l + "</p>").join("") +
      (top.length ? "<ol class=\"moments\">" + top.map((m, i) =>
        "<li><p>" + (m.text || m.type) + (m.bestSan ? " Best was " + m.bestSan + "." : "") + "</p>" +
        (m.fen ? "<div class=\"nav-row\"><button type=\"button\" class=\"show-moment\" data-i=\"" + i + "\">Show on the board</button>" +
          "<button type=\"button\" class=\"try-again\" data-i=\"" + i + "\">Try again from here</button></div>" +
          "<p class=\"muted moment-hint\">Red is the move you played; green is the engine’s better idea. Use the routine: what did his last move want, is anything hanging, then try a different candidate.</p>" : "") +
        "</li>"
      ).join("") + "</ol>" : "") +
      "<div class=\"nav-row\"><button type=\"button\" class=\"primary\" id=\"pg-new\">New game</button></div>";

    function arrowsFor(m) {
      const arrows = [];
      if (m.playedFrom && m.playedTo) arrows.push({ from: m.playedFrom, to: m.playedTo, color: "#c45c4a" });
      if (m.bestFrom && m.bestTo && (m.bestFrom !== m.playedFrom || m.bestTo !== m.playedTo)) {
        arrows.push({ from: m.bestFrom, to: m.bestTo, color: "#3d8b6e" });
      } else if (m.fen && m.bestSan && typeof Chess !== "undefined") {
        try {
          const c = new Chess(m.fen);
          const mv = (window.SCSan && window.SCSan.move) ? window.SCSan.move(c, m.bestSan) : c.move(m.bestSan);
          if (mv && (mv.from !== m.playedFrom || mv.to !== m.playedTo)) arrows.push({ from: mv.from, to: mv.to, color: "#3d8b6e" });
        } catch (e) {}
      }
      return arrows;
    }
    box.querySelectorAll(".show-moment").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = top[Number(btn.getAttribute("data-i"))];
        if (!m || !m.fen || !window.board) return;
        window.board.setPosition(m.fen, null);
        if (window.board.setArrows) window.board.setArrows(arrowsFor(m));
        status("The position before that move. Red is what you played; green is the better idea.");
      });
    });
    const pgNew = box.querySelector("#pg-new");
    if (pgNew) pgNew.addEventListener("click", () => newGame());
    box.querySelectorAll(".try-again").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = top[Number(btn.getAttribute("data-i"))];
        if (!m || !m.fen) return;
        window.__qa.setPosition(m.fen, state.playAs);
        if (window.board && window.board.setArrows) window.board.setArrows(arrowsFor(m));
        status("Same position, your move. Try a different idea.");
        pushCoach("info", "Back to that moment. " + (m.nudge || "Look at checks, captures, and threats first. Then try to break your own candidate before you play it."));
      });
    });
    if (window.BoardView) window.BoardView.keep(box);
  }

  function collectHighlights(list) {
    window.board.setHighlights(list || []);
  }

  function showLiveHints() {
    if (state.mode === "off") return;
    const last = state.history[state.history.length - 1];
    const hi = [];
    const arrows = [];

    let info = { messages: [], highlights: [], arrows: [] };
    try { info = window.Coach.threatsFromLastMove(state.chess, last, blakeColor()) || info; } catch (e) { console.warn("threat cues failed", e); }
    hi.push.apply(hi, info.highlights);
    if (info.arrows) arrows.push.apply(arrows, info.arrows);
    if (info.messages.length) {
      for (const m of info.messages) {
        pushCoach("warn", m);
        state.log.push({ type: "threat", text: m, ply: state.uciHistory.length, severe: true, fen: state.chess.fen() });
      }
    }

    if (state.mode === "hints") {
      let takes = [];
      try { takes = window.Coach.missedCaptures(state.chess, blakeColor()) || []; } catch (e) { console.warn("missed-capture cue failed", e); }
      for (const t of takes) {
        pushCoach("tip", t.message);
        hi.push({ square: t.square, kind: "take" });
        state.log.push({ type: "missed_capture", text: t.message, ply: state.uciHistory.length, fen: state.chess.fen() });
      }
    }

    /* One opening cue when we're still in a studied line. */
    if (state.mode === "hints" && window.Openings && window.Openings.liveCue) {
      const cue = window.Openings.liveCue(state.uciHistory, state.playAs);
      if (cue && cue.text) {
        setLineBadge((cue.opening && cue.opening.name) || "");
        pushCoach("tip", cue.text);
      }
    }

    /* Fianchetto plans — especially vs White's 1.g3 / 1.b4. */
    if (state.mode !== "off" && window.Fianchetto && window.Fianchetto.detect) {
      try {
        const det = window.Fianchetto.detect(state.chess, blakeColor(), last) || { cues: [] };
        (det.cues || []).forEach((c) => {
          if (c.id === state.lastCueId && c.kind !== "warn") return;
          if (state.mode === "warn" && c.kind !== "warn") return;
          pushCoach(c.kind === "warn" ? "warn" : "principle", c.text);
          if (c.highlights) hi.push.apply(hi, c.highlights);
          if (c.arrows) arrows.push.apply(arrows, c.arrows);
          state.lastCueId = c.id;
          state.log.push({ type: "fianchetto", id: c.id, text: c.text, ply: state.uciHistory.length, fen: state.chess.fen(), severe: c.kind === "warn" });
        });
      } catch (e) { console.warn("fianchetto cue failed", e); }
    }

    /* A single general thinking cue if nothing else fired in hints mode. */
    if (state.mode === "hints" && !info.messages.length) {
      const hint = window.Coach.hintForPosition(state.chess, last, blakeColor(), { mode: state.mode });
      if (hint && hint.text && hint.text.indexOf("Quick check") === -1) {
        pushCoach("tip", hint.text);
        if (hint.highlights) hi.push.apply(hi, hint.highlights);
        if (hint.arrows) arrows.push.apply(arrows, hint.arrows);
      }
    }

    collectHighlights(hi);
    if (window.board.setArrows) window.board.setArrows(arrows);
  }

  async function botTurn() {
    if (state.over) return;
    state.thinking = true;
    status(profile().shortName + " is thinking…");
    let uci = bookMoveForBot();
    if (uci) {
      const tmp = new Chess(state.chess.fen());
      if (!uciToMove(tmp, uci)) uci = null;
      else {
        state.bookHits++;
        state.bookPlies++;
      }
    }
    if (!uci) {
      try {
        uci = await chooseEngineMove();
      } catch (e) {
        console.error(e);
        const ms = state.chess.moves({ verbose: true });
        uci = ms.length ? ms[0].from + ms[0].to + (ms[0].promotion || "") : null;
      }
    }
    state.thinking = false;
    if (!uci) return;
    const mv = uciToMove(state.chess, uci);
    if (!mv) {
      status("Engine move was illegal; trying again.");
      return botTurn();
    }
    state.uciHistory.push(uci);
    state.history.push(mv);
    window.board.setPosition(state.chess.fen(), { from: mv.from, to: mv.to });
    if (window.Feel) { try { window.Feel.moved(mv, state.chess); } catch (e) { console.warn(e); } }
    else if (window.Sound) { if (mv.captured) window.Sound.capture(); else window.Sound.move(); }
    setPhase();
    maybeLeaveTheory();
    status("Your move");
    const ended = gameEnded();
    if (ended) {
      endGame(ended, ended === "win" ? "Checkmate — you win." : ended === "loss" ? "Checkmate." : "Game drawn.");
      return;
    }
    if (await capReached()) return;
    await refreshEval();
    showLiveHints();
    if (state.mode !== "off" && state.evalCp != null && state.evalCp >= 300) {
      pushCoach("tip", "You're ahead. Trading pieces makes this easier to convert.");
    }
  }

  function offerTakeback(review, tried) {
    state.pending = { review: review, tried: tried };
    const bar = $("#takeback-bar");
    bar.hidden = false;
    $("#takeback-text").textContent = review.text || "There's a clearly better move than that.";
    const lineEl = $("#takeback-line");
    if (lineEl) lineEl.textContent = review.line ? "If you keep it: " + review.line : "";
    const nudgeEl = $("#takeback-nudge");
    if (nudgeEl) nudgeEl.textContent = review.nudge || "";
    const reveal = $("#best-reveal");
    if (reveal) { reveal.hidden = true; reveal.textContent = ""; }
    if (review.highlights) window.board.setHighlights(review.highlights);
    if (review.arrows && window.board.setArrows) window.board.setArrows(review.arrows);
    if (window.Sound) window.Sound.warn();
  }

  function confirmPending() {
    state.pending = null;
    hideTakeback();
    afterBlakeMoveSettled();
  }

  function doTakeback() {
    if (!state.pending) return;
    state.chess.undo();
    state.uciHistory.pop();
    state.history.pop();
    state.pending = null;
    hideTakeback();
    window.board.setPosition(state.chess.fen(), state.history.length ? { from: state.history[state.history.length - 1].from, to: state.history[state.history.length - 1].to } : null);
    window.board.setHighlights([]);
    if (window.board.setArrows) window.board.setArrows([]);
    status("Move taken back. Try again.");
    setPhase();
    showLiveHints();
  }

  function showBestMove() {
    if (!state.pending || !state.pending.review) return;
    const r = state.pending.review;
    const el = $("#best-reveal");
    if (!el) return;
    el.hidden = false;
    el.textContent = (r.bestReason || ("Best was " + (r.bestSan || "a different move") + ".")) +
      (r.evalWords ? " " + r.evalWords : "");
  }

  async function afterBlakeMoveSettled() {
    const ended = gameEnded();
    if (ended) {
      endGame(ended, ended === "win" ? "Checkmate — you win." : ended === "loss" ? "Checkmate." : "Game drawn.");
      return;
    }
    if (await capReached()) return;
    maybeLeaveTheory();
    await botTurn();
  }

  function pvToMove(chess, pv) {
    if (!pv || !pv.pv || !pv.pv[0]) return null;
    const u = pv.pv[0];
    return { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] };
  }

  async function reviewBlakeMove(chessBefore, move, chessAfter) {
    if (!state.engineReady) {
      return { warn: false, text: "", flags: [], highlights: [], drop: 0 };
    }
    await state.engine.setCoachingStrength();
    try {
      const fen = chessBefore.fen();
      const playedUci = move.from + move.to + (move.promotion || "");
      const multi = await state.engine.analyze(fen, { movetime: 500, depth: 14, multipv: 3 });
      const inPv = (multi.pvs || []).find(function (pv) { return pv && pv.pv && pv.pv[0] === playedUci; });
      let playedPv;
      if (inPv) {
        playedPv = inPv;
      } else {
        const playedRes = await state.engine.analyze(fen, { movetime: 250, depth: 12, multipv: 1, searchmoves: [playedUci] });
        playedPv = (playedRes.pvs && playedRes.pvs[0]) || { score: 0, isMate: false, pv: [playedUci] };
      }
      const bestPv = (multi.pvs && multi.pvs[0]) || { score: 0, isMate: false, pv: [multi.bestmove] };
      const bestSans = window.Coach.sanLine(chessBefore, bestPv.pv, 3);
      /* PV includes the move just played; the tip wants the opponent's replies after it. */
      const playedFull = window.Coach.sanLine(chessBefore, playedPv.pv, 4);
      const playedSans = playedFull.slice(1);
      const bestMove = pvToMove(chessBefore, bestPv);
      return window.Coach.reviewFromAnalysis({
        chessBefore: chessBefore,
        chessAfter: chessAfter,
        move: move,
        best: { score: bestPv.score, isMate: bestPv.isMate, pv: bestPv.pv, san: bestSans[0], move: bestMove },
        played: { score: playedPv.score, isMate: playedPv.isMate, pv: playedPv.pv, san: playedSans[0], move: move },
        playedSans: playedSans,
        bestSans: bestSans,
        pvScores: (multi.pvs || []).map((p) => window.Coach.scoreToCp(p)),
        inTop3: !!(multi.pvs || []).find(function (pv) { return pv && pv.pv && pv.pv[0] === playedUci; }),
        mode: state.mode
      });
    } finally {
      try { await state.engine.restorePlayStrength(); } catch (e) {}
    }
  }

  function maybeHFileCoach(move) {
    if (state.mode === "off" || !window.Fianchetto || !window.Fianchetto.checkHFile) return;
    if (!window.Fianchetto.isHPawnMove(move, blakeColor())) return;
    const ch = window.Fianchetto.checkHFile(state.chess, blakeColor(), move);
    if (!ch || !ch.text) return;
    const kind = ch.kind === "ok" ? "tip" : ch.kind;
    pushCoach(kind, ch.text);
    state.log.push({
      type: "h-checklist",
      text: ch.text,
      missing: (ch.missing || []).map(function (m) { return m.id; }),
      ply: state.uciHistory.length,
      fen: state.chess.fen(),
      severe: kind === "warn"
    });
  }

  function onBoardMoveFixed(spec) {
    void handleBlakeMove(spec);
  }

  async function handleBlakeMove(spec) {
    if (state.over || state.thinking || state.pending) return;
    if (state.chess.turn() !== blakeColor()) return;
    const fenBefore = state.chess.fen();
    const chessBefore = new Chess(fenBefore);
    const preview = new Chess(fenBefore);
    const mv = preview.move({ from: spec.from, to: spec.to, promotion: spec.promotion || "q" });
    if (!mv) return;
    applyMove({ from: spec.from, to: spec.to, promotion: spec.promotion || "q" });
    if (state.mode === "off") {
      afterBlakeMoveSettled();
      return;
    }
    state.thinking = true;
    status("Checking that move…");
    let review;
    try {
      review = await reviewBlakeMove(chessBefore, mv, state.chess);
    } catch (e) {
      console.error(e);
      review = { warn: false, text: "", flags: [], highlights: [] };
    }
    state.thinking = false;
    if (review.praise && review.text) {
      pushCoach("ok", review.text);
      if (window.Sound) window.Sound.good();
    }
    maybeHFileCoach(mv);
    if (review.warn && state.mode !== "off") {
      pushCoach("warn", review.text);
      const bestMv = review.bestMove || (review.best && review.best.move) || null;
      state.log.push({
        type: "eval_drop",
        text: review.text,
        nudge: review.nudge,
        line: review.line,
        bestSan: review.bestSan,
        drop: review.drop,
        ply: state.uciHistory.length,
        fen: fenBefore,
        playedSan: mv.san,
        playedFrom: mv.from,
        playedTo: mv.to,
        bestFrom: bestMv && bestMv.from,
        bestTo: bestMv && bestMv.to,
        severe: true
      });
      offerTakeback(review, mv);
      status("Want a takeback?");
      return;
    }
    afterBlakeMoveSettled();
  }

  async function newGame(opts) {
    opts = opts || {};
    showGameUI();
    if (state._boot) { try { await state._boot; } catch (e) {} }
    state.chess = new Chess();
    state.history = [];
    state.uciHistory = [];
    state.pending = null;
    state.leftTheory = false;
    state.log = [];
    state.evalCp = null;
    state.over = false;
    state.bookHits = 0;
    state.bookPlies = 0;
    state.thinking = false;
    state.lastCueId = null;
    if (!opts.keepBot) { state.bot = null; state.onEnd = null; }
    state.startFen = opts.fen || null;
    if (opts.fen) {
      try {
        const c = new Chess(opts.fen);
        state.chess = c;
        state.leftTheory = true;
      } catch (e) {
        state.chess = new Chess();
      }
    }
    if (!opts.keepColor) {
      const colorSel = $("#color-select").value;
      state.playAs = colorSel === "random" ? (Math.random() < 0.5 ? "white" : "black") : colorSel;
    }
    if (!opts.keepOpp) state.opponentId = $("#opp-select").value;
    state.mode = $("#mode-select").value;
    window.board.setFlipped(state.playAs === "black");
    window.board.setPosition(state.chess.fen(), null);
    window.board.setHighlights([]);
    if (window.board.setArrows) window.board.setArrows([]);
    if ($("#postgame")) $("#postgame").hidden = true;
    renderCoachStart();
    if (opts.note) pushCoach("info", opts.note);
    const myTurn = state.chess.turn() === blakeColor();
    status(myTurn ? "Your move" : profile().shortName + " to move");
    if (!myTurn) await botTurn();
  }

  async function startSparring(opts) {
    opts = opts || {};
    showGameUI();
    if (window.UI && window.UI.showTab) window.UI.showTab("play");
    if (opts.opponentId) {
      try { $("#opp-select").value = opts.opponentId; } catch (e) {}
      state.opponentId = opts.opponentId;
    }
    if (opts.color) {
      const color = opts.color === "b" || opts.color === "black" ? "black" : "white";
      try { $("#color-select").value = color; } catch (e) {}
      state.playAs = color;
    }
    state.bot = opts.bot || null;
    state.onEnd = opts.onEnd || null;
    await newGame({ keepColor: !!opts.color, keepOpp: !!opts.opponentId, fen: opts.fen, note: opts.note, keepBot: true });
  }

  async function playFromFen(opts) {
    opts = opts || {};
    return startSparring({
      fen: opts.fen,
      color: opts.color || opts.playAs || "white",
      opponentId: opts.opponentId || currentOpponent() || state.opponentId,
      note: opts.note || "Play it out from this position. Look for the plan, not just a move."
    });
  }

  async function bootEngineAndBooks() {
    try {
      await loadBooks();
    } catch (e) {
      pushCoach("warn", "Couldn't load opening books. The bot will still play with the engine.");
      state.books = {};
      state.vsBooks = {};
    }
    state.engine = new window.StockfishEngine();
    try {
      await state.engine.start();
      state.engineReady = true;
      setEngineLabel("Engine ready", true);
      notifyAndroidEngine(true);
      const p = profile();
      await state.engine.setStrength(p.elo, p.skill);
      if (window.SCAccount && window.SCAccount.analyzeQueued) window.SCAccount.analyzeQueued(state.engine);
    } catch (e) {
      console.error(e);
      setEngineLabel("Engine failed — book moves only", false);
      notifyAndroidEngine(false, e && e.message);
    }
  }

  async function init() {
    setEngineLabel("Engine warming…", false);
    if (window.Feel) {
      const m = $("#btn-mute"), r = $("#btn-motion"), c = $("#btn-character");
      if (m) m.addEventListener("click", () => window.Feel.toggleMute());
      if (r) r.addEventListener("click", () => window.Feel.toggleReducedMotion());
      if (c) c.addEventListener("click", () => { const sh = $("#settings-sheet"); if (sh) sh.hidden = true; window.Adventure && window.Adventure.openEditor(); });
      // Inline rename lives in Settings only while it is open (one character-name field on screen at a time).
      const so = $("#btn-settings"), host = $("#char-edit-fields");
      const fillName = () => {
        if (!host) return;
        const ch = (window.Adventure && window.Adventure.getCharacter()) || {};
        host.innerHTML = '<label class="field">Character name <input id="set-char-name" data-testid="character-name" maxlength="18" autocomplete="off"></label>' +
          '<button type="button" class="ghost" data-testid="character-save" id="set-char-save">Save name</button>';
        const nm = $("#set-char-name"), sv = $("#set-char-save");
        nm.value = ch.name || "";
        sv.addEventListener("click", () => {
          const c2 = Object.assign({}, (window.Adventure && window.Adventure.getCharacter()) || {});
          c2.name = (nm.value || "").trim() || c2.name || "Player";
          window.Adventure.setCharacter(c2);
          sv.textContent = "Saved";
          setTimeout(() => { sv.textContent = "Save name"; }, 1200);
        });
      };
      if (so) so.addEventListener("click", fillName);
      window.Feel.apply && window.Feel.apply();
    }
    window.board = new window.BoardUI($("#board"), {
      flipped: false,
      showMaterial: true,
      canMove: () => !state.over && !state.thinking && !state.pending && state.chess.turn() === blakeColor(),
      onMove: onBoardMoveFixed,
    });
    const themeSel = $("#theme-select");
    if (themeSel && window.BoardUI) {
      const cur = window.BoardUI.loadTheme();
      themeSel.value = cur;
      themeSel.addEventListener("change", () => {
        window.BoardUI.setTheme(themeSel.value);
        if (window.board && window.board.setTheme) window.board.setTheme(themeSel.value);
      });
    }
    const boot = state._boot = bootEngineAndBooks();
    if (window.UI) {
      try { await window.UI.init({ startSparring: startSparring, playFromFen: playFromFen, reviewMove: engineReview, currentOpponent: currentOpponent, engine: function () { return state.engine; } }); } catch (e) { console.error(e); }
    }
    if (location.search.indexOf("test=1") !== -1) {
      await boot;
    }
    bindChrome();
    renderLobby();
    showLobby();
    $("#btn-takeback").addEventListener("click", doTakeback);
    $("#btn-keep").addEventListener("click", confirmPending);
    if ($("#btn-show-best")) $("#btn-show-best").addEventListener("click", showBestMove);
    $("#btn-resign").addEventListener("click", () => {
      if (!state.over) endGame("loss", "You resigned.");
    });
    if (location.search.indexOf("test=1") !== -1) {
      showGameUI();
      await runSelfTests();
    }
  }

  function inGame() {
    const g = $("#game-ui");
    return g && !g.hidden;
  }

  function renderLobby() {
    const box = $("#opp-cards");
    if (!box || !window.PROFILES) return;
    const cur = currentOpponent();
    const ids = Object.keys(window.PROFILES);
    box.innerHTML = ids.map(function (id) {
      const p = window.PROFILES[id];
      return "<button type=\"button\" class=\"opp-card" + (id === cur ? " on" : "") + "\" data-id=\"" + id + "\">" +
        "<strong>" + (p.shortName || p.name || id) + "</strong>" +
        "<span>" + (p.ratingLabel || "") + "</span></button>";
    }).join("");
    box.querySelectorAll("[data-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-id");
        const sel = $("#opp-select");
        if (sel) sel.value = id;
        state.opponentId = id;
        renderLobby();
      });
    });
    renderWeakSpots();
  }
  if (window.SCAccount && window.SCAccount.onChange && !renderLobby._bound) {
    renderLobby._bound = true;
    window.SCAccount.onChange(function () { renderLobby(); });
  }

  async function renderWeakSpots() {
    const el = $("#weak-spots");
    if (!el) return;
    try {
      const spots = (window.SCAccount && window.SCAccount.weakSpots) ? await window.SCAccount.weakSpots() : [];
      const data = { title: "Know your weak spots", spots: spots };
      const cur = currentOpponent();
      const rows = (data.spots || []).map(function (s) {
        const p = window.PROFILES && window.PROFILES[s.persona];
        const label = p ? (p.shortName || p.name) : s.persona;
        const on = s.persona === cur ? " on" : "";
        return "<button type=\"button\" class=\"weak-spot" + on + "\" data-id=\"" + s.persona + "\">" +
          "<span class=\"ws-when\">" + s.when + " · " + s.record + "</span>" +
          "<span class=\"ws-go\">Spar " + label + "</span></button>";
      }).join("");
      if (!rows) {
        el.innerHTML = "<p class=\"ws-title\">Know your weak spots</p><p class=\"ws-why\">Connect your account on Today to see where you score worst.</p>";
        return;
      }
      el.innerHTML = "<p class=\"ws-title\">" + (data.title || "Know your weak spots") +
        " <button type=\"button\" class=\"text-btn why-btn\" id=\"ws-why\">Why?</button></p>" +
        "<p class=\"ws-why\" id=\"ws-why-text\" hidden>From your own games only, kept on this device.</p>" +
        rows;
      const why = $("#ws-why", el) || el.querySelector("#ws-why");
      const whyText = el.querySelector("#ws-why-text");
      if (why && whyText) why.addEventListener("click", function (e) { e.stopPropagation(); whyText.hidden = !whyText.hidden; });
      el.querySelectorAll("[data-id]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          const id = btn.getAttribute("data-id");
          const sel = $("#opp-select");
          if (sel) sel.value = id;
          state.opponentId = id;
          renderLobby();
        });
      });
    } catch (e) { /* card is optional */ }
  }

  function bindChrome() {
    const sheet = $("#settings-sheet");
    function openSheet() { if (sheet) sheet.hidden = false; }
    function closeSheet() { if (sheet) sheet.hidden = true; }
    if ($("#btn-settings")) $("#btn-settings").addEventListener("click", openSheet);
    if ($("#btn-settings-close")) $("#btn-settings-close").addEventListener("click", closeSheet);
    if (sheet) sheet.addEventListener("click", function (e) { if (e.target === sheet) closeSheet(); });
    if ($("#new-game")) $("#new-game").addEventListener("click", function () { closeSheet(); newGame(); });
    if ($("#btn-play")) $("#btn-play").addEventListener("click", function () { newGame(); });
    if ($("#opp-select")) $("#opp-select").addEventListener("change", function () {
      state.opponentId = $("#opp-select").value;
      renderLobby();
      if (inGame()) newGame();
    });
    if ($("#color-select")) $("#color-select").addEventListener("change", function () {
      if (inGame()) newGame();
    });
    if ($("#mode-select")) $("#mode-select").addEventListener("change", function (e) {
      state.mode = e.target.value;
      pushCoach("info", state.mode === "hints" ? "Hints on." : state.mode === "warn" ? "Warn only." : "Coach off.");
    });
  }

  async function engineReview(fen, san) {
    const chessBefore = new Chess(fen);
    const chessAfter = new Chess(fen);
    const move = (window.SCSan && window.SCSan.move) ? window.SCSan.move(chessAfter, san) : chessAfter.move(san);
    if (!move) throw new Error("illegal " + san + " in " + fen);
    return reviewBlakeMove(chessBefore, move, chessAfter);
  }

  async function runSelfTests() {
    const results = [];
    const log = (ok, msg) => {
      results.push((ok ? "PASS: " : "FAIL: ") + msg);
    };
    $("#postgame").hidden = false;
    const stream = $("#coach-stream");
    if (stream) stream.innerHTML = '<div class="coach-msg info">Self-test running… results will show below, not as live tips.</div>';
    try {
      if (!state.books) await loadBooks();
      if (window.UI && window.UI.loadData) await window.UI.loadData();
      const root = state.books && state.books["fianchetto-grinder"] && state.books["fianchetto-grinder"].white[""];
      const keys = Object.keys(root || {});
      const hasFlank = keys.indexOf("b2b4") !== -1 && keys.indexOf("g2g3") !== -1;
      log(hasFlank, "Fianchetto Grinder White book includes 1.b4 and 1.g3");
      const counts = { b2b4: 0, g2g3: 0, d2d4: 0, other: 0 };
      state.opponentId = "fianchetto-grinder";
      state.playAs = "black";
      state.uciHistory = [];
      for (let i = 0; i < 80; i++) {
        const m = bookMoveForBot();
        if (m === "b2b4") counts.b2b4++;
        else if (m === "g2g3") counts.g2g3++;
        else if (m === "d2d4") counts.d2d4++;
        else counts.other++;
      }
      const flankShare = (counts.b2b4 + counts.g2g3) / 80;
      log(flankShare >= 0.55 && counts.b2b4 > 5 && counts.g2g3 > 5, "Book sampling favors 1.b4/1.g3 (b4=" + counts.b2b4 + ", g3=" + counts.g2g3 + ", d4=" + counts.d2d4 + ")");

      const fenQ = "r5k1/5pb1/2p1qnpp/p3N3/P2Pp3/2P1BP1P/Q5PK/4R3 w - - 0 26";
      const hung = window.Coach.hangingBySee(new Chess(fenQ), "w");
      const queenHang = hung.some((h) => h.square === "a2" && h.piece === "q");
      log(queenHang, "Coach detects White’s hanging queen on a2");

      if (!state.engineReady) {
        state.engine = new window.StockfishEngine();
        await state.engine.start();
        state.engineReady = true;
        setEngineLabel("Engine ready", true);
        notifyAndroidEngine(true);
      }

      const qe6Fen = "r3k2r/ppp2p2/4p3/8/8/3n4/PPPPQPPP/4R1K1 w kq - 0 1";
      const qe6 = await engineReview(qe6Fen, "Qxe6");
      const tip = ((qe6.text || "") + " " + (qe6.line || "") + " " + (qe6.nudge || "")).toLowerCase();
      const mentionsLine = /fxe6|nxe1/.test(tip);
      log(!!qe6.warn && mentionsLine && !!(qe6.nudge && qe6.nudge.length > 10),
        "Qe6/Qxe6 warns with a real tip (warn=" + qe6.warn + ", line=" + qe6.line + ", nudge=" + qe6.nudge + ")");

      const blunderFen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
      const blunder = await engineReview(blunderFen, "Qh4");
      log(!!blunder.warn && /queen/i.test((blunder.text || "") + (blunder.line || "")),
        "Genuine blunder ...Qh4 is warned (warn=" + blunder.warn + ", text=" + blunder.text + ")");

      const fairFen = "r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3";
      const fair = await engineReview(fairFen, "exd4");
      log(!fair.warn, "Equal pawn trade ...exd4 is not flagged (warn=" + fair.warn + ", drop=" + fair.drop + ", reason=" + fair.reason + ")");

      const lostFen = "7q/5pk1/8/8/8/8/5PPP/6K1 w - - 0 1";
      const lost = await engineReview(lostFen, "h3");
      log(!lost.warn, "Already-lost position is not nagged for h3 (warn=" + lost.warn + ", drop=" + lost.drop + ", reason=" + lost.reason + ")");

      const sacFen = "r2qkbnr/ppp2ppp/2np4/4p2b/2B1P3/2N2N1P/PPPP1PP1/R1BQK2R w KQkq - 1 6";
      const sac = await engineReview(sacFen, "Nxe5");
      log(!sac.warn, "Working sac Nxe5 (Legal's) is not flagged (warn=" + sac.warn + ", drop=" + sac.drop + ", reason=" + sac.reason + ")");

      const res = await state.engine.analyze("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", { movetime: 400, multipv: 1 });
      log(!!(res.bestmove && /^[a-h][1-8][a-h][1-8]/.test(res.bestmove)), "Engine responded with a move: " + res.bestmove);

      /* Fianchetto module */
      const g3 = new Chess("rnbqkbnr/pppppppp/8/8/8/6P1/PPPPPP1P/RNBQKBNR b KQkq - 0 1");
      const early = window.Fianchetto.detect(g3, "b");
      log((early.cues || []).some((c) => c.id === "h-too-early"), "After 1.g3, live cue warns that the h-pawn is too early");

      const rookFen = "r1bqk2r/p1pnbppp/1p1p1n2/PP2p3/8/6P1/1BPPPPBP/RN1QK1NR b KQkq - 2 7";
      const diag = window.Fianchetto.detect(new Chess(rookFen), "b");
      log((diag.cues || []).some((c) => c.id === "diag-hang"), "Bg2 vs the a8 rook fires the long-diagonal cue: " + JSON.stringify((diag.cues || []).map((c) => c.id)));

      const data = window.Fianchetto.data && window.Fianchetto.data();
      if (!data && window.Fianchetto.load) {
        await window.Fianchetto.load();
      }
      const F = window.Fianchetto.data();
      const nDrills = F && F.drills && F.drills.length;
      const nGames = F && F.modelGames && F.modelGames.length;
      const hasH = !!(F && F.hFileChecklist && F.hFileChecklist.length === 6);
      const hasModel = !!(F && F.modelGames && F.modelGames.every(function (g) { return !/^blake-/.test(g.id || "") && !/chess\.com/i.test(g.url || ""); }));
      const hasNew = !!(F && F.drills && ["h4-better-be3","e4-uncastled-hstorm","h5-early-rb1","h3-ne3-hangs"].every(function (id) {
        return F.drills.some(function (d) { return d.id === id; });
      }));
      log(nDrills >= 11 && nGames >= 3 && hasH && hasModel && hasNew,
        "Fianchetto module loaded (" + (nDrills || 0) + " drills, " + (nGames || 0) + " model games, checklist=" + hasH + ")");

      const hPos = new Chess("rn1q1rk1/1b2ppbp/pp6/3p1pP1/3P4/2N2N1P/PPP5/R1BQK1R1 w Q - 0 15");
      hPos.move("h4");
      const ch = window.Fianchetto.checkHFile(hPos, "w", { san: "h4", piece: "p", from: "h3", to: "h4" });
      const miss = (ch.missing || []).map(function (m) { return m.id; });
      log(!!ch && miss.indexOf("king") >= 0 && miss.indexOf("trade") >= 0,
        "After 15.h4 vs a fianchetto, checklist flags uncastled king and untraded bishop: " + miss.join(","));

      if (window.Openings && !window.Openings.data) {
        try { await window.Openings.load(); } catch (e2) {}
      }
      const need = ["ponziani", "vienna", "scotch", "rousseau", "pirc", "caro"];
      const have = (window.Openings.openings() || []).map(function (o) { return o.id; });
      const missing = need.filter(function (id) { return have.indexOf(id) < 0; });
      log(!missing.length, "Repertoire includes " + need.join(", ") + (missing.length ? " (missing " + missing.join(", ") + ")" : ""));
      function nCh(id) {
        const o = window.Openings.opening(id);
        return o && o.chapters ? o.chapters.length : 0;
      }
      log(nCh("vienna") >= 6 && nCh("rousseau") >= 6 && nCh("pirc") >= 6 && nCh("caro") >= 6 && nCh("scotch") >= 3 && nCh("ponziani") >= 4,
        "Chapter counts at Ponziani standard (vienna=" + nCh("vienna") + ", rousseau=" + nCh("rousseau") + ", pirc=" + nCh("pirc") + ", caro=" + nCh("caro") + ", scotch=" + nCh("scotch") + ", ponziani=" + nCh("ponziani") + ")");

      const scored = window.FindOpenings && window.FindOpenings.score({
        "white-feel": "solid", theory: "less", "black-e4": "counter", races: "no", unusual: "same"
      }, window.UI && window.UI.blake);
      const topW = scored && scored.white && scored.white[0] && scored.white[0].id;
      const topB = scored && scored.black && scored.black[0] && scored.black[0].id;
      log(!!scored && topW === "ponziani" && topB === "pirc",
        "Find-your-openings quiz scores a solid/less-theory/Pirc mix as Ponziani + Pirc (white=" + topW + ", black=" + topB + ")");

      const nClarity = window.UI && window.UI.clarity && window.UI.clarity.positions ? window.UI.clarity.positions.length : 0;
      const nPlans = window.UI && window.UI.pircPlans && window.UI.pircPlans.systems ? window.UI.pircPlans.systems.length : 0;
      log(nClarity >= 6 && nPlans >= 6, "Clarity drill has " + nClarity + " positions; Pirc/Modern plans cover " + nPlans + " White systems");

      const svgOk = !!document.querySelector("#board img.cb-piece");
      log(svgOk, "Play board renders SVG pieces");

      const pon = window.Openings.opening("ponziani");
      const ch0 = pon && pon.chapters && pon.chapters[0];
      const parts = (window.Practice && ch0) ? window.Practice.chunks(pon, ch0) : [];
      log(parts.length >= 1 && parts[0].moves && parts[0].moves.length >= 2, "Practice chunks a Ponziani chapter (" + parts.length + " chunks)");
      const endHtml = (window.UI && ch0) ? window.UI.chapterEndHTML(pon, ch0, { correct: 11, total: 11, complete: true }) : "";
      log(/end-next/.test(endHtml) && /end-again/.test(endHtml) && /end-back/.test(endHtml) && !/end-tree/.test(endHtml) && !/id="end-quiz"/.test(endHtml),
        "Chapter end has Next chapter, Again, and Back (no Tree map)");
      log(/11 of 11 moves played/.test(endHtml) && /Ponziani · /.test(endHtml) && /chapters/.test(endHtml),
        "Chapter end reports this run’s moves and chapters, not raw SRS counts");

      const rous = "r1bqkbnr/pppp2pp/2n5/4pp2/2BPP3/5N2/PPP2PPP/RNBQK2R b KQkq - 0 4";
      const rc = new Chess(rous);
      const fxe4 = (window.SCSan && window.SCSan.move) ? window.SCSan.move(rc, "fxe4") : rc.move("fxe4");
      log(!!fxe4, "Rousseau 4...fxe4 is legal in the Clarity FEN");

      if (window.DrillAudit && window.DrillAudit.run) {
        const aud = await window.DrillAudit.run();
        window.__qa.lastAudit = aud;
        log(aud.ok, "Drill audit: " + aud.issues.length + " issue(s)" + (aud.issues[0] ? " first=" + aud.issues[0].where + " " + aud.issues[0].issue : "") +
          " (clarity=" + aud.counts.clarity + ", fianchetto=" + aud.counts.fianchetto + ", pirc=" + aud.counts.pirc + ")");
      } else {
        log(false, "Drill audit missing");
      }

      if (window.Practice && window.Practice.auditAll) {
        const cov = window.Practice.auditAll();
        window.__qa.lastCoverage = cov;
        const first = cov.issues && cov.issues[0];
        log(!!cov.ok, "Chapter walk covers every move (" + cov.usMoves + " us-moves, " + cov.chapters + " chapters, " + cov.chunks + " chunks, " + (cov.issues || []).length + " issue(s)" + (first ? " first=" + first.opening + "/" + first.chapter + " " + first.issue : "") + ")");
        log(cov.chunks >= cov.chapters, "Chunks cover branches, not only the main line");
      } else {
        log(false, "Practice.auditAll missing");
      }

      const lastCh = pon && pon.chapters && pon.chapters[pon.chapters.length - 1];
      const lastHtml = (window.UI && lastCh) ? window.UI.chapterEndHTML(pon, lastCh, { correct: 11, total: 11, complete: true }) : "";
      log(/end-quiz-opening/.test(lastHtml) && /primary/.test(lastHtml) && !/id="end-next"/.test(lastHtml) && /end-again/.test(lastHtml) && /end-back/.test(lastHtml),
        "Last chapter end has Quiz this opening as the primary, plus Again and Back");
      const endsOk = (window.Openings.openings() || []).every(function (o) {
        const chs = o.chapters || [];
        if (!chs.length) return true;
        const html = window.UI.chapterEndHTML(o, chs[chs.length - 1]);
        return /primary/.test(html);
      });
      log(endsOk, "Every last-chapter end screen has a primary button");

      const vienna = window.Openings.opening("vienna");
      const vCh = vienna && vienna.chapters && vienna.chapters[0];
      let altOk = false;
      if (vienna && window.Openings.repertoireMovesAt) {
        const pos = window.Openings.learnOrder(vienna, vCh) || [];
        for (let i = 0; i < pos.length; i++) {
          const fen = window.Openings.fenAfter(pos[i].path.slice(0, -1));
          const alts = window.Openings.repertoireMovesAt(vienna, fen);
          if (alts.length > 1) { altOk = true; break; }
        }
      }
      log(altOk, "Quiz can see more than one repertoire move at a Vienna position");
      log(window.UI.shortOpeningName(vienna) === "Vienna" && window.UI.shortOpeningName(pon) === "Ponziani",
        "Opening titles shorten to Vienna / Ponziani");

      if (window.SCSan && window.SCSan.playLine) {
        const games = (window.Fianchetto.data() && window.Fianchetto.data().modelGames) || [];
        const bad = [];
        games.forEach(function (g) {
          const r = window.SCSan.playLine(g.sans || []);
          if (!r.ok) bad.push((g.id || g.title || "?") + " ply " + r.at + " " + r.san);
        });
        function walkSan(node, chess, label, acc) {
          ((node && node.replies) || []).forEach(function (r) {
            const snap = chess.fen();
            if (r.san) {
              const c2 = new Chess(snap);
              const ok = window.SCSan.move(c2, r.san);
              if (!ok) acc.push(label + " " + r.san);
            }
            const u = r.uci;
            const okU = u && chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
            if (okU) {
              walkSan(r, chess, label + "/" + (r.san || r.uci), acc);
              chess.undo();
            }
          });
        }
        const treeBad = [];
        (window.Openings.openings() || []).forEach(function (o) {
          (o.chapters || []).forEach(function (ch) {
            walkSan(ch.tree || { replies: ch.replies || [] }, new Chess(), o.id + "/" + ch.id, treeBad);
          });
        });
        log(!bad.length && !treeBad.length, "Strict SAN audit of bundled games and lines" +
          (bad[0] ? " (games: " + bad[0] + ")" : "") + (treeBad[0] ? " (tree: " + treeBad[0] + ")" : ""));
      } else {
        log(false, "SCSan missing");
      }

      if (window.SCAccount && window.SCAccount.spotLabel) {
        const v = window.SCAccount.spotLabel({ id: "vienna", name: "the Vienna" }, "white", 2, 0, 4, 6);
        const f = window.SCAccount.spotLabel({ id: "french", name: "the French" }, "white", 3, 1, 4, 8);
        log(v.when === "Your Vienna as White" && v.record === "2 wins in 6",
          "Weak-spot label for your own White opening: " + v.when + " · " + v.record);
        log(f.when === "As White vs the French" && /3 wins, 1 draw in 8/.test(f.record),
          "Weak-spot label for an opening you face: " + f.when + " · " + f.record);
      } else {
        log(false, "spotLabel missing");
      }

      log(!!(window.SCAccount && window.SCDB && window.SCFSRS && window.SCThink), "Connect, FSRS, and Think With Me modules loaded");
      const sample = window.SCAccount.parsePgnGames('[Event "t"]\n[White "Me"]\n[Black "Opp"]\n[Result "0-1"]\n[Opening "London System"]\n\n1. d4 d5 2. Bf4 0-1\n');
      log(sample.length === 1 && sample[0].opening.indexOf("London") !== -1, "PGN import parses a game without a network");
      log(window.SCThink.steps.join(">") === "scan>threats>candidates>plan>check>move", "Think With Me follows scan, threats, candidates, plan, check, move");
      const showBtns = Array.from(document.querySelectorAll("button")).filter(function (b) {
        const cs = getComputedStyle(b);
        if (cs.display === "none" || cs.visibility === "hidden") return false;
        return false;
      });
      log(!!document.querySelector('img.cb-piece[src*="cburnett"]'), "Play board uses Cburnett SVG pieces");
    } catch (e) {
      log(false, "Exception: " + e.message);
      console.error(e);
    }
    $("#postgame").hidden = false;
    $("#postgame").innerHTML = "<h3>Self-test</h3><pre>" + results.join("\n") + "</pre>";
    status("Self-test finished");
    window.__qa.lastTest = results;
  }

  /* 1.6.0 hooks: rating, strength, tracks, adventure, placement. */
  (function qa16() {
    const q = window.__qa = window.__qa || {};
    const A = () => window.Adventure, Pr = () => window.Progress;
    const def = (k, get) => { try { Object.defineProperty(q, k, { get, configurable: true, enumerable: true }); } catch (e) {} };
    def("rating", () => { const r = Pr().get().rating; return { estimate: Math.round(r.estimate), rd: Math.round(r.rd), games: r.games }; });
    def("adventureStart", () => (window.Lessons && window.Lessons.data() ? A().start() : null));
    def("trainLessonId", () => "u2-hanging");
    def("character", () => A().getCharacter());
    Object.assign(q, {
      getRating: () => q.rating,
      adventureNode: (lessonId) => {
        const list = A().nodes();
        if (lessonId) { const n = A().nodeForLesson(lessonId); return n ? (list.find((x) => x.id === n.id) || n) : null; }
        return list.find((x) => !x.complete && !x.locked) || null;
      },
      setRating: (n) => { A().setRating(n); return q.rating; },
      strength: (r) => window.Strength.strength(r == null ? Pr().get().rating.estimate : r),
      bossStrength: () => A().bossStrength(),
      rivalStrength: () => A().rivalStrength(),
      engineMode: (r) => window.Strength.engineMode(r == null ? Pr().get().rating.estimate : r),
      startPlacement: () => A().startPlacement(),
      finishPlacement: (res) => A().finishPlacement(res),
      completeTrainLesson: (id) => window.Journey.completeFromLesson(id || "u2-hanging", 1),
      openTrain: () => window.UI.showTab("train"),
      openAdventure: () => window.UI.showTab("adventure"),
      openHome: () => window.UI.showTab("today"),
      lessons: () => window.Lessons.list(),
      progress: () => Pr().get()
    });
    const boot = () => setTimeout(() => {
      try { A() && A().ensureCharacter(); } catch (e) {}
      if (window.Lessons && window.Packs) window.Lessons.load().then(() => window.Packs.loadBundled()).then((r) => { (r || []).forEach((x) => { if (!x.ok) console.warn("pack rejected:", x.reason); }); }).catch(() => {});
    }, 60);
    if (document.readyState === "complete") boot(); else window.addEventListener("load", boot);
  })();

  window.__qa = Object.assign(window.__qa || {}, {
    state: state,
    fen() { return state.chess.fen(); },
    status() { return ($("#status") && $("#status").textContent) || ""; },
    thinking() { return !!state.thinking; },
    over() { return !!state.over; },
    playAs() { return state.playAs; },
    history() { return state.uciHistory.slice(); },
    coachTexts() { return Array.from(document.querySelectorAll("#coach-stream .coach-msg")).map((el) => el.textContent); },
    takeback() {
      const bar = $("#takeback-bar");
      return {
        hidden: !bar || bar.hidden,
        why: ($("#takeback-text") && $("#takeback-text").textContent) || "",
        line: ($("#takeback-line") && $("#takeback-line").textContent) || "",
        nudge: ($("#takeback-nudge") && $("#takeback-nudge").textContent) || "",
        best: ($("#best-reveal") && $("#best-reveal").textContent) || ""
      };
    },
    postgame() {
      const box = $("#postgame");
      return { hidden: !box || box.hidden, text: box ? box.innerText : "" };
    },
    metrics() { return window.board.metrics(); },
    async newGame() { return newGame(); },
    startSparring: startSparring,
    playFromFen: playFromFen,
    engineReview: engineReview,
    async playSan(san) {
      const mv = (window.SCSan && window.SCSan.move) ? window.SCSan.move(new Chess(state.chess.fen()), san) : (new Chess(state.chess.fen())).move(san);
      if (!mv) return null;
      await handleBlakeMove({ from: mv.from, to: mv.to, promotion: mv.promotion });
      return mv.san;
    },
    resign() { if (!state.over) endGame("loss", "You resigned."); },
    setPosition(fen, playAs) {
      state.chess = new Chess(fen);
      state.history = [];
      state.uciHistory = [];
      state.pending = null;
      state.leftTheory = true;
      state.log = [];
      state.evalCp = null;
      state.over = false;
      state.thinking = false;
      if (playAs) state.playAs = playAs;
      window.board.setFlipped(state.playAs === "black");
      window.board.setPosition(state.chess.fen(), null);
      window.board.setHighlights([]);
      if (window.board.setArrows) window.board.setArrows([]);
      if ($("#postgame")) $("#postgame").hidden = true;
      hideTakeback();
      setPhase();
      status("Your move");
    },
  });

  document.addEventListener("DOMContentLoaded", init);
})();
