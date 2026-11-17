/* Audit every drill and opening-tree "us" move: valid FEN, legal expected moves. */
(function () {
  function issues() { return []; }

  function tryChess(fen) {
    try {
      const c = new Chess(fen);
      if (c && c.fen()) return c;
    } catch (e) {}
    try {
      const c = new Chess();
      if (fen && c.load(fen)) return c;
    } catch (e) {}
    return null;
  }

  function legalSan(chess, san) {
    if (!chess || !san) return false;
    const c = new Chess(chess.fen());
    return !!c.move(san, { sloppy: true });
  }

  function legalUci(chess, uci) {
    if (!chess || !uci || uci.length < 4) return false;
    const c = new Chess(chess.fen());
    return !!c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }

  function add(out, where, issue, extra) {
    const row = { where: where, issue: issue };
    if (extra) row.extra = extra;
    out.push(row);
  }

  function checkPosition(out, where, fen, sans, ucis) {
    if (!fen) { add(out, where, "missing fen"); return; }
    const chess = tryChess(fen);
    if (!chess) { add(out, where, "invalid fen", fen); return; }
    (sans || []).forEach((san) => {
      if (san && !legalSan(chess, san)) add(out, where, "illegal expected move " + san, fen);
    });
    (ucis || []).forEach((uci) => {
      if (uci && !legalUci(chess, uci)) add(out, where, "illegal expected uci " + uci, fen);
    });
  }

  function walkTree(out, opening, ch, node, pathFen) {
    const chess = tryChess(pathFen);
    if (!chess) { add(out, opening.id + "/" + ch.id, "invalid path fen", pathFen); return; }
    ((node && node.replies) || []).forEach((r) => {
      const tag = opening.id + "/" + ch.id + "/" + (r.san || r.uci);
      if (!legalUci(chess, r.uci)) add(out, tag, "illegal tree move", chess.fen());
      const next = new Chess(chess.fen());
      const ok = next.move({ from: r.uci.slice(0, 2), to: r.uci.slice(2, 4), promotion: r.uci[4] });
      if (ok) walkTree(out, opening, ch, r, next.fen());
    });
  }

  async function run() {
    const out = [];
    const C = window.UI && window.UI.clarity;
    ((C && C.positions) || []).forEach((pos) => {
      checkPosition(out, "clarity:" + (pos.id || pos.title), pos.fen, pos.goodMoves || []);
    });
    const F = window.Fianchetto && window.Fianchetto.data && window.Fianchetto.data();
    ((F && F.drills) || []).forEach((d) => {
      const sans = [].concat(d.acceptedMoves || [], d.preferredMoves || [], d.engineBest ? [d.engineBest] : []);
      checkPosition(out, "fianchetto:" + (d.id || d.title), d.fen, sans);
    });
    const P = window.UI && window.UI.pircPlans;
    ((P && P.drills) || []).forEach((d) => {
      checkPosition(out, "pirc:" + (d.id || d.system || d.prompt), d.fen, d.goodMoves || []);
    });
    const openings = (window.Openings && window.Openings.openings && window.Openings.openings()) || [];
    openings.forEach((o) => {
      (o.chapters || []).forEach((ch) => {
        walkTree(out, o, ch, ch.tree || { replies: [] }, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      });
    });
    return { ok: out.length === 0, issues: out, counts: {
      clarity: ((C && C.positions) || []).length,
      fianchetto: ((F && F.drills) || []).length,
      pirc: ((P && P.drills) || []).length,
      openings: openings.length
    } };
  }

  window.DrillAudit = { run: run };
})();
