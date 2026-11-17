/* Live cues and helpers for the Fianchetto module.
   Detects White-style g3/Bg2, b4/Bb2, and Pirc/Modern g7 plans. */
(function () {
  const FILES = "abcdefgh";

  function sq(file, rank) { return FILES[file] + rank; }

  function pieceAt(chess, square) {
    return chess.get(square);
  }

  function kingSquare(chess, color) {
    const b = chess.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = b[r][f];
      if (p && p.type === "k" && p.color === color) return FILES[f] + (8 - r);
    }
    return null;
  }

  function hasBishop(chess, square, color) {
    const p = pieceAt(chess, square);
    return !!(p && p.type === "b" && p.color === color);
  }

  function pawnOn(chess, square, color) {
    const p = pieceAt(chess, square);
    return !!(p && p.type === "p" && p.color === color);
  }

  /* Long diagonals: a1-h8 and a8-h1. */
  function diagonalFrom(square, dirFile, dirRank) {
    const f = FILES.indexOf(square[0]);
    const r = parseInt(square[1], 10);
    const out = [];
    let ff = f + dirFile, rr = r + dirRank;
    while (ff >= 0 && ff < 8 && rr >= 1 && rr <= 8) {
      out.push(FILES[ff] + rr);
      ff += dirFile; rr += dirRank;
    }
    return out;
  }

  function longDiagonalTargets(chess, bishopSq) {
    const p = pieceAt(chess, bishopSq);
    if (!p || p.type !== "b") return [];
    const dirs = bishopSq === "g2" || bishopSq === "b7"
      ? [[-1, 1], [1, -1]]
      : bishopSq === "b2" || bishopSq === "g7"
        ? [[1, 1], [-1, -1]]
        : [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    const hits = [];
    dirs.forEach((d) => {
      const ray = diagonalFrom(bishopSq, d[0], d[1]);
      for (let i = 0; i < ray.length; i++) {
        const q = ray[i];
        const occ = pieceAt(chess, q);
        if (!occ) continue;
        if (occ.color !== p.color && (occ.type === "r" || occ.type === "q" || occ.type === "k")) {
          hits.push({ square: q, piece: occ.type, bishop: bishopSq });
        }
        break;
      }
    });
    return hits;
  }

  function centerLocked(chess) {
    /* Closed or fixed: opposing pawns blocking e or d files. */
    const pairs = [
      ["e4", "e5"], ["d4", "d5"], ["e4", "d5"], ["d4", "e5"]
    ];
    let locks = 0;
    pairs.forEach((pr) => {
      const a = pieceAt(chess, pr[0]);
      const b = pieceAt(chess, pr[1]);
      if (a && b && a.type === "p" && b.type === "p" && a.color !== b.color) locks++;
    });
    return locks >= 1 && pawnOn(chess, "e4", "w") && pawnOn(chess, "e5", "b") ||
           (pawnOn(chess, "d4", "w") && pawnOn(chess, "d5", "b")) ||
           (pawnOn(chess, "d5", "w") && pawnOn(chess, "e5", "b") && pawnOn(chess, "e4", "w"));
  }

  function ourFianchetto(chess, us) {
    if (us === "b") return hasBishop(chess, "g7", "b") || hasBishop(chess, "b7", "b");
    return hasBishop(chess, "g2", "w") || hasBishop(chess, "b2", "w");
  }

  function enemyFianchettoKing(chess, them) {
    const ks = kingSquare(chess, them);
    if (them === "w") {
      /* Prefer the kingside bishop even if the g-pawn has already moved or traded. */
      const bg2 = hasBishop(chess, "g2", "w");
      return { bishop: bg2 ? "g2" : (hasBishop(chess, "b2", "w") ? "b2" : null), king: ks, short: ks === "g1" };
    }
    const bg7 = hasBishop(chess, "g7", "b");
    return { bishop: bg7 ? "g7" : (hasBishop(chess, "b7", "b") ? "b7" : null), king: ks, short: ks === "g8" };
  }


  function cueText(id, fallback) {
    const list = (data && data.liveCues) || [];
    const hit = list.filter(function (c) { return c.id === id; })[0];
    return (hit && hit.text) || fallback;
  }

  function fullmove(chess) {
    return parseInt(String(chess.fen()).split(" ")[5], 10) || 1;
  }

  function legalSan(chess, san) {
    try {
      const mv = (window.SCSan && window.SCSan.move) ? window.SCSan.move(chess, san) : chess.move(san);
      if (!mv) return false;
      chess.undo();
      return true;
    } catch (e) { return false; }
  }


  function isHPawnMove(move, us) {
    if (!move) return false;
    const san = move.san || "";
    const piece = move.piece || (move.from && ("" + move.from)[0] === "h" ? "p" : "");
    const from = move.from || "";
    const to = move.to || "";
    if (from && from[0] === "h" && to && (to[0] === "h" || to[0] === "g")) {
      if (us === "w") return parseInt(to[1], 10) > parseInt(from[1], 10);
      if (us === "b") return parseInt(to[1], 10) < parseInt(from[1], 10);
    }
    return /^(h[345]|hxg[345]|hxh)/.test(san.replace(/^.*\.\.\./, ""));
  }

  function centerStable(chess) {
    if (centerLocked(chess)) return true;
    /* Held chains that aren't a full lock, e.g. d4 vs d5, e4 vs e6, Advance structures. */
    const held = [
      pawnOn(chess, "d4", "w") && pawnOn(chess, "d5", "b"),
      pawnOn(chess, "e4", "w") && pawnOn(chess, "e5", "b"),
      pawnOn(chess, "e5", "w") && (pawnOn(chess, "d5", "b") || pawnOn(chess, "e6", "b")),
      pawnOn(chess, "d5", "w") && (pawnOn(chess, "d6", "b") || pawnOn(chess, "e5", "b")),
      pawnOn(chess, "e4", "b") && pawnOn(chess, "e3", "w"),
      pawnOn(chess, "d4", "b") && pawnOn(chess, "d3", "w")
    ];
    return held.some(Boolean);
  }

  function fileClosedByHim(chess, us) {
    const them = us === "w" ? "b" : "w";
    if (us === "w") {
      return pawnOn(chess, "h6", "b") || pawnOn(chess, "g5", "b") || pawnOn(chess, "g4", "b");
    }
    return pawnOn(chess, "h3", "w") || pawnOn(chess, "g4", "w") || pawnOn(chess, "g3", "w") && pawnOn(chess, "h3", "w");
  }

  function kingSafe(chess, us) {
    const ks = kingSquare(chess, us);
    if (!ks) return { ok: false, opposite: false, square: ks };
    const castled = (us === "w" && (ks === "c1" || ks === "g1")) || (us === "b" && (ks === "c8" || ks === "g8"));
    const them = us === "w" ? "b" : "w";
    const ek = kingSquare(chess, them);
    const weLong = ks === (us === "w" ? "c1" : "c8");
    const theyShort = ek === (them === "w" ? "g1" : "g8");
    const weShort = ks === (us === "w" ? "g1" : "g8");
    const theyLong = ek === (them === "w" ? "c1" : "c8");
    const opposite = (weLong && theyShort) || (weShort && theyLong);
    return { ok: !!castled, opposite: !!opposite, square: ks };
  }

  function backupOnHFile(chess, us) {
    const files = "abcdefgh";
    const board = chess.board();
    let queen = false, rook = false, extra = 0;
    const qSquares = us === "w" ? ["d2", "h6", "h4", "h5", "h3", "f4", "g5"] : ["d7", "h3", "h5", "h4", "h6", "f5", "g4"];
    const extraSq = us === "w"
      ? ["f3", "g5", "e5", "d3", "c4", "h6", "g4", "e4"]
      : ["f6", "g4", "e4", "d6", "c5", "h3", "g5", "e5"];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (!p || p.color !== us) continue;
      const s = files[f] + (8 - r);
      if (p.type === "q" && (s[0] === "h" || qSquares.indexOf(s) >= 0)) queen = true;
      if (p.type === "r" && s[0] === "h") rook = true;
      if ((p.type === "n" || p.type === "b") && extraSq.indexOf(s) >= 0) extra++;
    }
    return { queen: queen, rook: rook, extra: extra, ok: queen && rook && extra >= 1, count: (queen ? 1 : 0) + (rook ? 1 : 0) + Math.min(extra, 2) };
  }

  function secondPush(move, us) {
    if (!move || !move.from) return false;
    const fromRank = parseInt(move.from[1], 10);
    if (us === "w") return fromRank >= 3; /* already left h2 */
    return fromRank <= 6; /* already left h7 */
  }

  function checkHFile(chess, us, lastMove) {
    const them = us === "w" ? "b" : "w";
    const him = enemyFianchettoKing(chess, them);
    const fianchettoSetup = them === "w"
      ? (pawnOn(chess, "g3", "w") || hasBishop(chess, "g2", "w") || pawnOn(chess, "b3", "w") || hasBishop(chess, "b2", "w"))
      : (pawnOn(chess, "g6", "b") || hasBishop(chess, "g7", "b") || pawnOn(chess, "b6", "b") || hasBishop(chess, "b7", "b"));
    const items = [];
    const centerOk = centerStable(chess);
    items.push({ id: "center", ok: centerOk, missing: "the center is still open — lock or hold it first" });
    const king = kingSafe(chess, us);
    items.push({
      id: "king",
      ok: king.ok,
      missing: "your king is still on " + (king.square || "e-file") + " — castle, ideally on the other side, before the file opens",
      ideal: king.opposite
    });
    const bishopGone = !him.bishop;
    const tradeReady = him.bishop && (legalSan(chess, us === "b" ? "Bh3" : "Bh6") || legalSan(chess, us === "b" ? "Qd7" : "Qd2"));
    /* After a successful trade the bishop isn't on g2/g7. If it's still there, the item fails. */
    items.push({
      id: "trade",
      ok: bishopGone,
      missing: him.bishop
        ? ("his bishop on " + him.bishop + " is still the key defender — trade it first with " + (us === "b" ? "...Qd7 and ...Bh3" : "Qd2 and Bh6"))
        : "trade his fianchetto bishop first",
      ready: tradeReady
    });
    const backup = backupOnHFile(chess, us);
    const isSecond = secondPush(lastMove, us);
    const backupOk = isSecond ? backup.ok : (backup.count >= 2 || backup.ok);
    items.push({
      id: "backup",
      ok: backupOk,
      missing: isSecond
        ? "the second h-pawn push needs the queen, a rook on the h-file, and one more piece ready"
        : "the h-pawn is going mostly alone — get the queen, a rook, and one more piece onto the attack first"
    });
    const closed = fileClosedByHim(chess, us);
    items.push({
      id: "closed",
      ok: !closed,
      missing: "he is closing or has closed the h-file — switch to the f-pawn lever or break in the center instead of pushing again"
    });
    const hangs = [];
    ["g2", "b2", "g7", "b7"].forEach(function (s) {
      if (!hasBishop(chess, s, them)) return;
      longDiagonalTargets(chess, s).forEach(function (hit) {
        if (hit.piece !== "k") hangs.push(hit);
      });
    });
    items.push({
      id: "diag",
      ok: hangs.length === 0,
      missing: hangs.length
        ? ("a " + (hangs[0].piece === "r" ? "rook" : "queen") + " on " + hangs[0].square + " is loose on the long diagonal of his bishop — tuck it before you push")
        : "check the long diagonal (a8/a1) before you push"
    });
    const missing = items.filter(function (it) { return !it.ok; });
    const justPushed = !!(lastMove && isHPawnMove(lastMove, us));
    let text;
    if (missing.length === 0) {
      text = justPushed
        ? "The h-pawn is on time: the center is held, your king is safe, and you have backup on the file. If he closes it, switch to the f-pawn or the center."
        : "The h-pawn lever is on time. The checklist is clear: center held, king safe, bishop traded or gone, and pieces ready on the file.";
    } else {
      const list = missing.map(function (it) { return it.missing; }).join("; ");
      text = justPushed
        ? ("You pushed the h-pawn, but the checklist isn’t done: " + list + ".")
        : ("Before you push the h-pawn, the checklist is missing: " + list + ".");
    }
    const kind = (justPushed && missing.length >= 2) || hangs.length ? "warn" : (missing.length ? "tip" : "ok");
    return {
      ok: missing.length === 0,
      missing: missing,
      items: items,
      text: text,
      kind: kind,
      justPushed: justPushed,
      closed: closed,
      setup: !!(him.bishop || fianchettoSetup),
      id: justPushed ? "h-just-pushed" : (closed && missing.some(function (m) { return m.id === "closed"; }) ? "h-closed" : "h-checklist")
    };
  }

  function detect(chess, us, lastMove) {
    const them = us === "w" ? "b" : "w";
    const cues = [];
    const him = enemyFianchettoKing(chess, them);
    const meFianchetto = ourFianchetto(chess, us);
    const locked = centerLocked(chess);

    /* Loose major piece on the long diagonal of his fianchetto bishop. */
    ["g2", "b2", "g7", "b7"].forEach((s) => {
      if (!hasBishop(chess, s, them)) return;
      longDiagonalTargets(chess, s).forEach((hit) => {
        if (hit.piece === "k") return;
        cues.push({
          id: "diag-hang",
          kind: "warn",
          principleId: "dont-grab",
          text: cueText("diag-hang", "Check the long diagonal. His bishop on {bishop} is looking at {target}. Tucking that piece, or closing the diagonal, comes before any attack.")
          .replace("{bishop}", s)
          .replace("{target}", "your " + (hit.piece === "r" ? "rook" : "queen") + " on " + hit.square),
          arrows: [{ from: s, to: hit.square, color: "#e07a5f" }],
          highlights: [{ square: s, kind: "warn" }, { square: hit.square, kind: "hang" }]
        });
      });
    });

    /* Trade the defender: ...Qd7 / ...Bh3 or Qd2 / Bh6. */
    if (him.bishop && him.short) {
      const trade = us === "b"
        ? (legalSan(chess, "Qd7") || legalSan(chess, "Bh3") || legalSan(chess, "Qd8") /* keep */)
        : (legalSan(chess, "Qd2") || legalSan(chess, "Bh6"));
      const setup = us === "b" ? "...Qd7 and ...Bh3" : "Qd2 and Bh6";
      if (legalSan(chess, us === "b" ? "Bh3" : "Bh6") || legalSan(chess, us === "b" ? "Qd7" : "Qd2")) {
        cues.push({
          id: "trade-ready",
          kind: "tip",
          principleId: "remove-defender",
          text: cueText("trade-ready", "His bishop on {bishop} is the key defender. Look at {setup} to trade it off before you try to break through.")
          .replace("{bishop}", him.bishop)
          .replace("{setup}", setup),
          arrows: him.bishop ? [{ from: us === "b" ? "c8" : "c1", to: us === "b" ? "h3" : "h6", color: "#81b29a" }] : [],
          highlights: [{ square: him.bishop, kind: "hint" }]
        });
      }
    }

    /* H-pawn timing + the six-point checklist. */
    const fianchettoSetup = them === "w"
      ? (pawnOn(chess, "g3", "w") || hasBishop(chess, "g2", "w") || pawnOn(chess, "b3", "w") || hasBishop(chess, "b2", "w"))
      : (pawnOn(chess, "g6", "b") || hasBishop(chess, "g7", "b") || pawnOn(chess, "b6", "b") || hasBishop(chess, "b7", "b"));
    const hPush = us === "b" ? (legalSan(chess, "h5") || legalSan(chess, "h4")) : (legalSan(chess, "h4") || legalSan(chess, "h5"));
    const hCheck = checkHFile(chess, us, lastMove);
    const justPushedH = !!(lastMove && isHPawnMove(lastMove, us));
    if (justPushedH && (him.bishop || fianchettoSetup || !hCheck.ok)) {
      cues.push({
        id: hCheck.id,
        kind: hCheck.kind === "ok" ? "tip" : hCheck.kind,
        principleId: "sac-lines",
        text: hCheck.text,
        checklist: hCheck,
        highlights: (hCheck.missing || []).length ? [] : [{ square: us === "b" ? "h5" : "h4", kind: "hint" }]
      });
    }
    if (hCheck.closed && !justPushedH && (hPush || him.bishop || fianchettoSetup)) {
      cues.push({
        id: "h-closed",
        kind: "tip",
        principleId: "dont-grab",
        text: cueText("h-closed", "He is closing the h-file. Don’t keep pushing it. Switch to the f-pawn lever or break in the center."),
        highlights: []
      });
    }
    if (hPush && (him.bishop || fianchettoSetup) && !justPushedH) {
      if (locked && him.short) {
        cues.push({
          id: "h-ready",
          kind: "tip",
          principleId: "sac-lines",
          text: cueText("h-ready", "The center is closed, so the h-pawn lever is a real idea now. Count attackers first, and make sure the long diagonal is safe."),
          highlights: [{ square: us === "b" ? "h7" : "h2", kind: "hint" }]
        });
      } else if (fullmove(chess) <= 12) {
        cues.push({
          id: "h-too-early",
          kind: "tip",
          principleId: "attack-center",
          text: cueText("h-too-early", "The h-pawn lever is for after the center is fixed. Right now a central move (...e5, ...d5, or a developing move) is the plan."),
          highlights: []
        });
      }
    }

    /* Own fianchetto wants a break. */
    if (meFianchetto) {
      const breaks = [];
      if (us === "b") {
        if (legalSan(chess, "e5")) breaks.push("...e5");
        if (legalSan(chess, "c5")) breaks.push("...c5");
        if (legalSan(chess, "d5")) breaks.push("...d5");
      } else {
        if (legalSan(chess, "e4")) breaks.push("e4");
        if (legalSan(chess, "c4")) breaks.push("c4");
      }
      if (breaks.length && fullmove(chess) >= 6) {
        cues.push({
          id: "own-break",
          kind: "tip",
          principleId: "least-active",
          text: cueText("own-break", "Your fianchetto bishop wants an open diagonal. Look at the {brk} break so it can actually attack something.")
          .replace("{brk}", breaks.slice(0, 2).join(" or ")),
          highlights: [{ square: us === "b" ? "g7" : "g2", kind: "hint" }]
        });
      }
    }

    /* Count attackers vs defenders when a kingside attack is on. */
    if (him.short && him.bishop && window.Smirnov && window.Smirnov.attackCount) {
      const atts = window.Smirnov.attackCount(chess, us, him.king) || [];
      const defs = window.Smirnov.attackCount(chess, them, him.king) || [];
      if (atts.length >= 3) {
        const tmpl = cueText("count", "Count attackers versus defenders around his king before you smash through. If you’re not ahead in the count, bring one more piece up.");
        cues.push({
          id: "count",
          kind: "tip",
          principleId: "outnumber",
          text: tmpl + " You have " + atts.length + ", he has " + defs.length + ".",
          highlights: atts.slice(0, 4).map(function (a) { return { square: a.from, kind: "hint" }; })
        });
      }
    }

    /* Limit to the most useful 1–2 cues so the phone stays calm. */
    const warn = cues.filter((c) => c.kind === "warn");
    const tips = cues.filter((c) => c.kind !== "warn");
    const picked = warn.concat(tips).slice(0, 2);
    return { cues: picked, locked: locked, enemy: him, ourFianchetto: meFianchetto };
  }

  let data = null;
  async function load() {
    if (data) return data;
    const base = new URL(".", document.baseURI || location.href);
    const res = await fetch(new URL("data/plans/fianchetto.json", base));
    data = await res.json();
    return data;
  }

  window.Fianchetto = { load: load, detect: detect, centerLocked: centerLocked, checkHFile: checkHFile, isHPawnMove: isHPawnMove, data: function () { return data; } };
})();
