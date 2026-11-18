/* Strict SAN helper, and a safety wrap around chess.js 0.12.1.

   chess.js attaches move() to each instance. Its sloppy mode can read a
   lowercase pawn capture like "bxa3" as a bishop move (or reject it), leaving
   every later position wrong.

   A second 0.12.1 bug can throw "Cannot read properties of null (reading 'type')"
   from make_move while building SAN (the Play crash vs the wing-pawn opener).
   We catch that, put the board back to the last good FEN, and return a safe
   empty result so the page does not die.
*/
(function () {
  if (typeof Chess === "undefined") return;

  if (!Chess.__scWrapped) {
    const Orig = Chess;
    function wrap(c) {
      if (!c || c.__scSafe) return c;
      c.__scSafe = true;
      const raw = {};
      ["move", "moves", "undo", "load", "fen", "history", "in_check", "in_checkmate", "in_stalemate", "in_draw", "in_threefold_repetition", "game_over"].forEach((name) => {
        if (typeof c[name] === "function") raw[name] = c[name].bind(c);
      });
      function restore(fen) {
        if (!fen || !raw.load) return;
        try { raw.load(fen); } catch (e) {}
      }
      function snap() {
        try { return raw.fen ? raw.fen() : null; } catch (e) { return null; }
      }
      if (raw.move) {
        c.move = function (spec, opts) {
          const fen = snap();
          try { return raw.move(spec, opts); }
          catch (e) {
            console.warn("Chess.move failed", e && e.message);
            restore(fen);
            return null;
          }
        };
      }
      if (raw.moves) {
        c.moves = function (opts) {
          const fen = snap();
          try { return raw.moves(opts); }
          catch (e) {
            console.warn("Chess.moves failed", e && e.message);
            restore(fen);
            return [];
          }
        };
      }
      if (raw.undo) {
        c.undo = function () {
          try { return raw.undo(); }
          catch (e) {
            console.warn("Chess.undo failed", e && e.message);
            return null;
          }
        };
      }
      if (raw.history) {
        c.history = function (opts) {
          const fen = snap();
          try { return raw.history(opts); }
          catch (e) {
            console.warn("Chess.history failed", e && e.message);
            restore(fen);
            return [];
          }
        };
      }
      ["in_check", "in_checkmate", "in_stalemate", "in_draw", "in_threefold_repetition", "game_over"].forEach((name) => {
        if (!raw[name]) return;
        c[name] = function () {
          const fen = snap();
          try { return raw[name](); }
          catch (e) {
            console.warn("Chess." + name + " failed", e && e.message);
            restore(fen);
            return false;
          }
        };
      });
      return c;
    }
    function ChessSafe(fen) {
      const c = arguments.length ? new Orig(fen) : new Orig();
      return wrap(c);
    }
    ChessSafe.__scWrapped = true;
    try { Object.setPrototypeOf(ChessSafe, Orig); } catch (e) {}
    ChessSafe.prototype = Orig.prototype;
    try {
      Object.defineProperty(ChessSafe, Symbol.hasInstance, {
        value: function (inst) { return !!inst && (inst.__scSafe || inst instanceof Orig); }
      });
    } catch (e) {}
    window.Chess = ChessSafe;
  }

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
