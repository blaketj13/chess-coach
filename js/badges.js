/* Badges from real games only: things you actually did on a board (sparring, rivals, linked games).
   Detection replays the moves with chess.js; nothing is self-reported. */
(function () {
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const DEFS = {
    "back-rank": { name: "Back-rank mate", line: "Mated a king trapped by its own pawns." },
    "fork": { name: "Knight fork", line: "One knight, two big targets." },
    "castle-5": { name: "Safe king", line: "Castled in five games in a row." },
    "convert": { name: "Converted", line: "Went five points up and finished the job." },
    "clean-win": { name: "Clean win", line: "Won without ever dropping three points." },
    "rush-20": { name: "Rush 20", line: "Twenty puzzles in one Rush." },
    // 1.6.1 drills: earned on the board too
    "calc-clean": { name: "Clear sight", line: "A full calculation set without a miss." },
    "blindfold": { name: "Blindfold", line: "Found the move with every piece hidden." },
    "clock-10": { name: "Ten on the clock", line: "Ten solves in one Blitz drill." },
    "clock-cool": { name: "Cool head", line: "Every position solved inside its think budget." }
  };
  function name(id) { return (DEFS[id] && DEFS[id].name) || id; }
  function material(c, color) { let s = 0; c.board().forEach((r) => r.forEach((p) => { if (p) s += (p.color === color ? 1 : -1) * VAL[p.type]; })); return s; }
  function attacksFrom(c, sq, color) {
    // Squares a knight on sq attacks (only knights are scored for the fork badge).
    const f = sq.charCodeAt(0) - 97, r = +sq[1] - 1, out = [];
    [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([df, dr]) => {
      const nf = f + df, nr = r + dr;
      if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) out.push(String.fromCharCode(97 + nf) + (nr + 1));
    });
    return out.map((s) => c.get(s)).filter((p) => p && p.color !== color);
  }
  /** Scan one finished game. moves: SAN list or verbose moves; me: "w" | "b"; result: "win" | "loss" | "draw". */
  function scanGame(moves, me, result, startFen) {
    const c = startFen ? new Chess(startFen) : new Chess();
    const got = new Set();
    let castled = false, maxUp = -99, minUp = 99, ply = 0;
    const base = material(c, me); // positions handed over already ahead don't count as conversions
    for (const m of moves) {
      const mv = c.move(typeof m === "string" ? m : { from: m.from, to: m.to, promotion: m.promotion }, { sloppy: true });
      if (!mv) break;
      ply++;
      if (mv.color === me) {
        if (/[kq]/.test(mv.flags)) castled = true;
        if (mv.piece === "n") {
          const hit = attacksFrom(c, mv.to, me).filter((p) => p.type === "k" || p.type === "q" || p.type === "r");
          const safe = !c.moves({ verbose: true }).some((x) => x.to === mv.to && x.captured);
          if (hit.length >= 2 && hit.some((p) => p.type !== "r") && safe) got.add("fork");
        }
        if (c.in_checkmate() && (mv.piece === "r" || mv.piece === "q")) {
          const backRank = me === "w" ? "8" : "1";
          if (mv.to[1] === backRank) got.add("back-rank");
        }
      }
      const up = material(c, me);
      if (up > maxUp) maxUp = up;
      if (ply > 16 && up < minUp) minUp = up;
    }
    if (result === "win" && base < 2 && maxUp >= 5) got.add("convert");
    if (result === "win" && moves.length >= 30 && minUp > -3) got.add("clean-win");
    return { badges: [...got], castled };
  }
  /** Record a game: awards new badges, tracks the castling run. Returns newly earned ids. */
  function fromGame(moves, me, result, opts) {
    if (!window.Progress) return [];
    const P = window.Progress.get();
    const r = scanGame(moves, me, result, opts && opts.fen);
    P.castleRun = r.castled ? (P.castleRun || 0) + 1 : 0;
    if (P.castleRun >= 5) r.badges.push("castle-5");
    window.Progress.save();
    const fresh = r.badges.filter((id) => window.Progress.badge(id));
    if (fresh.length && opts && opts.announce !== false && window.Feel) window.Feel.show("badge-unlock", name(fresh[0]));
    return fresh;
  }
  /** Linked games (Lichess, Chess.com, PGN): scanned once each, quietly. */
  async function scanLinked() {
    if (!window.SCDB || !window.SCAccount) return [];
    const acc = await window.SCAccount.getAccount();
    if (!acc) return [];
    const P = window.Progress.get();
    P.badgeScanned = P.badgeScanned || {};
    const games = ((await window.SCDB.all("games")) || []).filter((g) => !P.badgeScanned[g.id]).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const fresh = [];
    for (const g of games.slice(0, 300)) {
      P.badgeScanned[g.id] = 1;
      const me = String(g.white || "").toLowerCase() === String(acc.username).toLowerCase() ? "w" : String(g.black || "").toLowerCase() === String(acc.username).toLowerCase() ? "b" : null;
      if (!me) continue;
      const res = g.result === "1/2-1/2" ? "draw" : (g.result === "1-0") === (me === "w") ? "win" : "loss";
      try {
        const c = new Chess();
        if (!c.load_pgn(g.pgn || "", { sloppy: true })) continue;
        fresh.push(...fromGame(c.history(), me, res, { announce: false }));
      } catch (e) {}
    }
    window.Progress.save();
    return fresh;
  }
  window.Badges = { DEFS, name, scanGame, fromGame, scanLinked };
})();
