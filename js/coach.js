/* Engine-grounded live coaching: hanging-piece SEE, eval-drop takebacks, plain-English tips. */
(function () {
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const CENTS = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 10000 };
  const NAME = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

  function clone(chess) {
    const c = new Chess();
    c.load(chess.fen());
    return c;
  }

  function withTurn(chess, color) {
    const parts = chess.fen().split(" ");
    parts[1] = color;
    parts[3] = "-";
    const c = new Chess();
    if (!c.load(parts.join(" "))) return null;
    return c;
  }

  function attackers(chess, square, byColor) {
    try {
      const tmp = clone(chess);
      const occ = tmp.get(square);
      /* Removing a king makes chess.js crash when generating moves. */
      if (occ && occ.type !== "k") tmp.remove(square);
      if (!tmp.get(square)) {
        const enemy = byColor === "w" ? "b" : "w";
        tmp.put({ type: "n", color: enemy }, square);
      }
      const turned = withTurn(tmp, byColor);
      if (!turned) return [];
      return turned.moves({ verbose: true }).filter((m) => m.to === square);
    } catch (e) {
      return [];
    }
  }

  function see(chess, move, depth) {
    if (depth == null) depth = 0;
    if (depth > 10) return 0;
    const cap = move.captured ? CENTS[move.captured] : 0;
    const tmp = clone(chess);
    const played = tmp.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
    if (!played) return 0;
    const recs = tmp.moves({ verbose: true }).filter((m) => m.to === move.to && m.captured);
    if (!recs.length) return cap;
    let worst = 99999;
    for (let i = 0; i < recs.length; i++) {
      const theirGain = see(tmp, recs[i], depth + 1);
      const ourNet = cap - theirGain;
      if (ourNet < worst) worst = ourNet;
    }
    return worst;
  }

  function hangingPieces(chess, color) {
    const out = [];
    const b = chess.board();
    const files = "abcdefgh";
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = b[r][f];
        if (!piece || piece.color !== color || piece.type === "k") continue;
        const sq = files[f] + (8 - r);
        const atts = attackers(chess, sq, color === "w" ? "b" : "w");
        if (!atts.length) continue;
        const defs = attackers(chess, sq, color);
        const val = VAL[piece.type];
        const cheapest = Math.min.apply(null, atts.map((m) => VAL[m.piece] || 9));
        if (!defs.length || cheapest < val) {
          out.push({
            square: sq,
            piece: piece.type,
            name: NAME[piece.type],
            value: val,
            reason: !defs.length ? "undefended" : "attacked_by_lower",
            attackers: atts,
            see: null
          });
        }
      }
    }
    return out;
  }

  /* A piece is truly hanging only if the opponent has a capture with positive SEE. */
  function hangingBySee(chess, color) {
    const them = color === "w" ? "b" : "w";
    const out = [];
    const b = chess.board();
    const files = "abcdefgh";
    const turned = withTurn(chess, them);
    if (!turned) return out;
    const caps = turned.moves({ verbose: true }).filter((m) => m.captured);
    const bestBySq = {};
    for (let i = 0; i < caps.length; i++) {
      const m = caps[i];
      const s = see(turned, m);
      if (s <= 0) continue;
      if (!bestBySq[m.to] || s > bestBySq[m.to].see) {
        const piece = chess.get(m.to);
        if (!piece || piece.color !== color || piece.type === "k") continue;
        bestBySq[m.to] = {
          square: m.to,
          piece: piece.type,
          name: NAME[piece.type],
          value: VAL[piece.type],
          see: s,
          via: m.san || (m.from + m.to),
          from: m.from,
          attacker: m.piece
        };
      }
    }
    Object.keys(bestBySq).forEach((k) => out.push(bestBySq[k]));
    return out;
  }

  function kingSquare(chess, color) {
    const b = chess.board();
    const files = "abcdefgh";
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = b[r][f];
      if (p && p.type === "k" && p.color === color) return files[f] + (8 - r);
    }
    return null;
  }

  function scoreToCp(entry) {
    if (!entry) return 0;
    if (entry.isMate) {
      const m = entry.score;
      if (m === 0) return 0;
      return m > 0 ? 10000 - m : -10000 - m;
    }
    return entry.score;
  }

  function decideWarning(info) {
    const bestCp = info.bestCp;
    const playedCp = info.playedCp;
    const drop = bestCp - playedCp;
    const threshold = 150;
    const close = 100;
    if (drop < threshold) {
      return { warn: false, reason: "close_to_best", drop: drop };
    }
    if (info.inTop3 && drop < 200) {
      return { warn: false, reason: "in_top3", drop: drop };
    }
    if (info.isCapture && info.see != null && info.see >= 0 && drop < 200) {
      return { warn: false, reason: "fair_trade", drop: drop };
    }
    if (bestCp <= -200 && drop < threshold) {
      return { warn: false, reason: "already_bad", drop: drop };
    }
    const pvs = info.pvScores || [];
    if (pvs.length >= 2) {
      const spread = Math.max.apply(null, pvs) - Math.min.apply(null, pvs);
      if (spread <= close && Math.abs(playedCp - pvs[pvs.length - 1]) <= close) {
        return { warn: false, reason: "all_similar", drop: drop };
      }
    }
    const wasWinning = bestCp >= 150;
    const nowNotWinning = playedCp < 80;
    const wasEqual = bestCp > -80 && bestCp < 150;
    const nowLosing = playedCp <= -150;
    if (drop >= threshold || (wasWinning && nowNotWinning) || (wasEqual && nowLosing)) {
      return { warn: true, reason: "eval_drop", drop: drop };
    }
    return { warn: false, reason: "ok", drop: drop };
  }

  function phraseDrop(drop, mate) {
    if (mate) return mate > 0 ? "This gives up a forced mate." : "This walks into mate.";
    const d = Math.abs(drop || 0);
    if (d < 80) return "roughly equal";
    if (d < 180) return "This loses about a pawn.";
    if (d < 350) return "This loses about a minor piece.";
    if (d < 550) return "This loses about a rook.";
    if (d < 900) return "This loses almost a queen.";
    return "This loses about a queen.";
  }

  function uciOf(move) {
    if (!move) return "";
    if (typeof move === "string") return move;
    return move.from + move.to + (move.promotion || "");
  }

  function sanLine(chess, ucis, max) {
    const c = clone(chess);
    const out = [];
    const list = ucis || [];
    const n = Math.min(max || 3, list.length);
    for (let i = 0; i < n; i++) {
      const u = list[i];
      const from = u.slice(0, 2), to = u.slice(2, 4), promo = u.length > 4 ? u[4] : undefined;
      const mv = c.move({ from: from, to: to, promotion: promo || "q" });
      if (!mv) break;
      out.push(mv.san);
    }
    return out;
  }

  function formatLine(sans, startBlack) {
    if (!sans || !sans.length) return "";
    const parts = [];
    for (let i = 0; i < sans.length; i++) {
      if (startBlack && i === 0) parts.push("…" + sans[i]);
      else parts.push(sans[i]);
    }
    return parts.join(" ");
  }

  function describeCapture(san) {
    if (!san) return "a capture";
    if (san.indexOf("N") !== -1 && san.indexOf("x") !== -1) return "a knight capture";
    if (san.indexOf("B") !== -1 && san.indexOf("x") !== -1) return "a bishop capture";
    if (san.indexOf("R") !== -1 && san.indexOf("x") !== -1) return "a rook capture";
    if (san.indexOf("Q") !== -1 && san.indexOf("x") !== -1) return "a queen capture";
    if (san.indexOf("x") !== -1) return "a pawn capture";
    return san;
  }

  function nudgeToward(chessBefore, bestMove, played) {
    if (!bestMove) return "There's a clearly better idea. Look at checks, captures, and any loose pieces.";
    const tmp = clone(chessBefore);
    const mv = tmp.move({ from: bestMove.from, to: bestMove.to, promotion: bestMove.promotion || "q" });
    if (!mv) return "Look for checks, captures, and threats before you settle on a move.";
    if (mv.san.indexOf("#") !== -1) return "There's a direct way to finish this. Look at his king and the back rank.";
    if (mv.san.indexOf("+") !== -1) return "You had a check that needed a look. Start with checks, then captures.";
    if (mv.captured) {
      const name = NAME[mv.captured] || "piece";
      return "You had a stronger capture available. Look at his loose " + name + ".";
    }
    if (mv.flags && mv.flags.indexOf("k") !== -1 || mv.san === "O-O" || mv.san === "O-O-O") {
      return "Getting the king safe was the bigger priority. Castle if you still can.";
    }
    if (mv.piece === "n") return "Your knight can jump to a square that makes two threats at once. Look for checks and captures.";
    if (mv.piece === "q" && played && played.piece === "q") return "Your queen can still get to safety. Look for a square that isn't under fire.";
    if (mv.piece === "b") return "A bishop can still be improved. Look for a longer diagonal, or a way to get a sitting piece into the game.";
    if (mv.piece === "p") return "A pawn break or a small pawn move was stronger. Ask which pawn opens a line for your pieces.";
    return "Look for the move that improves your worst piece, or that goes forward and creates a threat.";
  }

  function whyBad(chessBefore, move, playedPvSans, hung) {
    const san = move.san || (move.from + move.to);
    const reply = playedPvSans && playedPvSans[0];
    const reply2 = playedPvSans && playedPvSans[1];
    if (hung && hung.length) {
      const h = hung.slice().sort((a, b) => b.value - a.value)[0];
      const how = reply ? "…" + reply : (h.via ? "…" + h.via : "a capture");
      if (h.value >= 9) return "After " + san + ", " + how + " wins your queen" + (h.see >= 800 ? "" : " for less than it's worth") + ".";
      if (h.value >= 5) return "After " + san + ", " + how + " wins your rook.";
      return "After " + san + ", " + how + " wins your " + h.name + ".";
    }
    if (reply) {
      let text = "After " + san + ", " + "…" + reply;
      if (reply2) text += " " + reply2;
      text += " is the problem.";
      return text;
    }
    return "After " + san + ", he has a much stronger reply than the move you chose accounts for.";
  }

  function reviewFromAnalysis(opts) {
    const chessBefore = opts.chessBefore;
    const chessAfter = opts.chessAfter;
    const move = opts.move;
    const best = opts.best; // {score,isMate,pv,san,from,to,promotion}
    const played = opts.played; // same
    const mode = opts.mode || "hints";
    const bestCp = scoreToCp(best);
    const playedCp = scoreToCp(played);
    const isCapture = !!(move && move.captured);
    let seeVal = null;
    if (isCapture) {
      try { seeVal = see(chessBefore, move); } catch (e) { seeVal = null; }
    }
    const pvScores = (opts.pvScores || []).slice();
    const decision = decideWarning({
      bestCp: bestCp,
      playedCp: playedCp,
      pvScores: pvScores,
      see: seeVal,
      isCapture: isCapture,
      inTop3: !!opts.inTop3
    });

    const hung = hangingBySee(chessAfter, move.color);
    const playedSans = opts.playedSans || [];
    const bestSans = opts.bestSans || [];
    const drop = decision.drop;
    const matePlayed = played && played.isMate && played.score < 0;
    const mateBest = best && best.isMate && best.score > 0;

    const review = {
      warn: decision.warn,
      reason: decision.reason,
      drop: drop,
      bestCp: bestCp,
      playedCp: playedCp,
      text: "",
      line: "",
      nudge: "",
      evalWords: phraseDrop(drop, matePlayed ? played.score : (mateBest && decision.warn ? 1 : 0)),
      bestSan: bestSans[0] || (best && best.san) || "",
      bestReason: "",
      highlights: [],
      arrows: [],
      hung: hung,
      praise: false,
      principleId: null,
      flags: []
    };

    if (decision.warn) {
      review.text = whyBad(chessBefore, move, playedSans, hung);
      review.line = formatLine(playedSans.slice(0, 3), true);
      review.nudge = nudgeToward(chessBefore, best && best.move, move);
      if (hung[0]) {
        review.highlights.push({ square: hung[0].square, kind: "hang" });
        if (hung[0].from) review.arrows.push({ from: hung[0].from, to: hung[0].square, color: "#e07a5f" });
      }
      review.bestReason = "Best was " + (review.bestSan || "a different move") + ". " + review.evalWords;
      review.flags.push({ type: "eval_drop", severe: true, text: review.text });
      if (window.Smirnov && window.Smirnov.detectAttack) {
        try {
          const atk = window.Smirnov.detectAttack(chessBefore, move.color);
          if (atk && atk.principle) review.principleId = atk.principle.id;
        } catch (e) {}
      }
    } else {
      const goodCapture = isCapture && seeVal != null && seeVal >= 100;
      const close = drop <= 40;
      const castle = move.san === "O-O" || move.san === "O-O-O";
      if (close && (goodCapture || castle || (opts.bookMove && close))) {
        review.praise = true;
        review.text = goodCapture
          ? "Nice — you took a piece that was really hanging."
          : castle
            ? "Good, the king is safe now. That's the right priority."
            : "That's a solid move. It stays with the plan.";
      } else if (close && Math.random() < 0.35) {
        review.praise = true;
        review.text = "That's a good one. Quiet, and it keeps your pieces safe.";
      }
    }
    return review;
  }

  function threatsFromLastMove(chess, lastMove, defenderColor) {
    const messages = [];
    const highlights = [];
    const arrows = [];
    if (chess.in_check()) {
      const ks = kingSquare(chess, defenderColor);
      messages.push("You're in check — deal with that first. Look at captures on the checking piece, blocks, and king moves.");
      if (ks) highlights.push({ square: ks, kind: "check" });
    }
    const hung = hangingBySee(chess, defenderColor);
    for (let i = 0; i < hung.length; i++) {
      const h = hung[i];
      if (h.value >= 3) {
        messages.push("Your " + h.name + " on " + h.square + " is genuinely hanging — " + (h.via ? "…" + h.via : "it can be taken") + " wins it.");
        highlights.push({ square: h.square, kind: "hang" });
        if (h.from) arrows.push({ from: h.from, to: h.square, color: "#e07a5f" });
      }
    }
    return { messages: messages, highlights: highlights, arrows: arrows, hung: hung };
  }

  function missedCaptures(chess, attackerColor) {
    const hung = hangingBySee(chess, attackerColor === "w" ? "b" : "w");
    return hung.filter((h) => h.value >= 3).map((h) => ({
      square: h.square,
      name: h.name,
      from: h.from,
      message: "His " + h.name + " on " + h.square + " is hanging. Look at captures first."
    }));
  }

  function gamePhase(chess) {
    const fen = chess.fen();
    const parts = fen.split(" ");
    const fullmove = parseInt(parts[5], 10) || 1;
    const pieceStr = parts[0].replace(/[0-9/]/g, "");
    const queens = (pieceStr.match(/[qQ]/g) || []).length;
    const minors = (pieceStr.match(/[nNbBrR]/g) || []).length;
    if (queens === 0 && minors <= 4) return "Endgame";
    const undeveloped = [];
    ["w", "b"].forEach((c) => {
      if (window.Smirnov) undeveloped.push(4 - window.Smirnov.developedCount(chess, c));
    });
    if (fullmove <= 12 && (undeveloped[0] > 0 || undeveloped[1] > 0)) return "Opening";
    if (fullmove <= 8) return "Opening";
    return "Middlegame";
  }

  function hintForPosition(chess, lastMove, us, opts) {
    const mode = (opts && opts.mode) || "hints";
    const out = { text: "", highlights: [], arrows: [], principleId: null, opening: opts && opts.opening || null, thinkHard: false };
    if (mode === "off") return out;

    const threats = threatsFromLastMove(chess, lastMove, us);
    if (threats.messages.length) {
      out.text = threats.messages[0];
      out.highlights = threats.highlights;
      out.arrows = threats.arrows;
      out.thinkHard = threats.hung.some((h) => h.value >= 5);
      return out;
    }

    if (mode === "hints") {
      const takes = missedCaptures(chess, us);
      if (takes.length) {
        out.text = takes[0].message;
        out.highlights = [{ square: takes[0].square, kind: "take" }];
        if (takes[0].from) out.arrows = [{ from: takes[0].from, to: takes[0].square, color: "#8fce7a" }];
        return out;
      }
    }

    if (opts && opts.openingCue) {
      out.text = opts.openingCue;
      if (opts.openingArrows) out.arrows = opts.openingArrows;
      return out;
    }

    if (window.Smirnov) {
      const atk = window.Smirnov.detectAttack(chess, us);
      if (atk && mode === "hints") {
        out.text = atk.cue;
        out.highlights = atk.highlights || [];
        out.arrows = atk.arrows || [];
        out.principleId = atk.principle.id;
        return out;
      }
      const idle = window.Smirnov.worstPiece(chess, us);
      if (idle && mode === "hints" && gamePhase(chess) === "Opening") {
        out.text = "Your " + idle.name + " on " + idle.sq + " is still at home. Ask: which is my worst piece, and how do I bring it in?";
        out.highlights = [{ square: idle.sq, kind: "take" }];
        return out;
      }
    }

    if (mode === "hints") {
      out.text = "Quick check before you move: what did his last move want, and do you have a check, capture, or threat?";
    }
    return out;
  }

  function pickPrinciple() {
    const list = (window.Smirnov && window.Smirnov.ROUTINE) || [];
    if (list.length) {
      const s = list[Math.floor(Math.random() * list.length)];
      return s.title + " — " + s.prompt;
    }
    return "Ask what his last move wanted, then look at checks, captures, and threats before you move.";
  }

  // Keep a thin sync reviewMove for older tests; prefer reviewFromAnalysis.
  function reviewMove(chessBefore, move, chessAfter, context) {
    const hung = hangingBySee(chessAfter, move.color);
    const flags = [];
    const highlights = [];
    if (hung.length && hung[0].value >= 3 && context && context.forceHangFlag) {
      flags.push({ type: "hung_piece", severe: true, text: "Careful — your " + hung[0].name + " on " + hung[0].square + " can be taken." });
      highlights.push({ square: hung[0].square, kind: "hang" });
    }
    return { flags: flags, highlights: highlights, hungAfter: hung };
  }

  window.Coach = {
    hangingPieces: hangingPieces,
    hangingBySee: hangingBySee,
    threatsFromLastMove: threatsFromLastMove,
    missedCaptures: missedCaptures,
    reviewMove: reviewMove,
    reviewFromAnalysis: reviewFromAnalysis,
    decideWarning: decideWarning,
    phraseDrop: phraseDrop,
    hintForPosition: hintForPosition,
    pickPrinciple: pickPrinciple,
    gamePhase: gamePhase,
    see: see,
    attackers: attackers,
    scoreToCp: scoreToCp,
    sanLine: sanLine,
    formatLine: formatLine,
    nudgeToward: nudgeToward,
    uciOf: uciOf,
    VAL: VAL,
    NAME: NAME,
    CENTS: CENTS
  };
})();
