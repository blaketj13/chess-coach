/* Strict SAN helper. chess.js 0.12.1 attaches move() to each instance, and its
   sloppy mode can read a lowercase pawn capture like "bxa3" as a bishop move
   (or reject it), leaving every later position wrong. */
(function () {
  if (typeof Chess === "undefined") return;

  window.SCSan = {
    move: function (chess, san) {
      if (!chess || san == null || san === "") return null;
      try {
        return chess.move(String(san), { sloppy: false }) || null;
      } catch (e) {
        return null;
      }
    },
    playLine: function (sans, startFen) {
      const c = startFen ? new Chess(startFen) : new Chess();
      const played = [];
      for (let i = 0; i < (sans || []).length; i++) {
        const fen = c.fen();
        const mv = window.SCSan.move(c, sans[i]);
        if (!mv) return { ok: false, at: i, san: sans[i], fen: fen, played: played };
        played.push(mv);
      }
      return { ok: true, at: (sans || []).length, fen: c.fen(), played: played };
    }
  };
})();
