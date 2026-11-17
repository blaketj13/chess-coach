/* SVG piece set (Cburnett, CC BY-SA 3.0), themes, animation, material, in-square coords. */
(function () {
  const THEMES = [
    { id: "green", name: "Green" },
    { id: "wood", name: "Wood" },
    { id: "blue", name: "Blue" },
    { id: "dark", name: "Dark" }
  ];
  const THEME_KEY = "sc.board.theme";
  const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const START_COUNTS = { w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 }, b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 } };

  function loadTheme() {
    try { return localStorage.getItem(THEME_KEY) || "wood"; } catch (e) { return "wood"; }
  }
  function saveTheme(id) {
    try { localStorage.setItem(THEME_KEY, id); } catch (e) {}
    document.documentElement.setAttribute("data-board-theme", id);
  }
  function pieceSrc(color, type) {
    const key = color + String(type || "p").toUpperCase();
    return new URL("vendor/pieces/cburnett/" + key + ".svg", document.baseURI || location.href).href;
  }
  function sqName(file, rank) { return "abcdefgh"[file] + (rank + 1); }
  function parseFenSafe(fen) {
    try {
      if (fen) return new Chess(fen);
    } catch (e) {}
    try {
      const c = new Chess();
      if (fen && c.load(fen)) return c;
    } catch (e) {}
    return new Chess();
  }
  function countPieces(chess) {
    const out = { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } };
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p) out[p.color][p.type]++;
      }
    }
    return out;
  }
  function missing(color, cur) {
    const miss = [];
    ["q", "r", "b", "n", "p"].forEach((t) => {
      const n = START_COUNTS[color][t] - (cur[color][t] || 0);
      for (let i = 0; i < n; i++) miss.push(t);
    });
    return miss;
  }
  function materialScore(cur) {
    let w = 0, b = 0;
    Object.keys(VALUES).forEach((t) => {
      w += (cur.w[t] || 0) * VALUES[t];
      b += (cur.b[t] || 0) * VALUES[t];
    });
    return { w: w, b: b, d: w - b };
  }

  if (!document.documentElement.getAttribute("data-board-theme")) {
    document.documentElement.setAttribute("data-board-theme", loadTheme());
  }

  class BoardUI {
    constructor(root, opts) {
      this.root = root;
      this.flipped = !!(opts && opts.flipped);
      this.onMove = (opts && opts.onMove) || function () {};
      this.canMove = (opts && opts.canMove) || function () { return true; };
      this.showMaterial = opts && opts.showMaterial === false ? false : true;
      this.selected = null;
      this.legal = [];
      this.highlights = [];
      this.lastMove = null;
      this.fen = new Chess().fen();
      this.arrows = [];
      this._drag = null;
      this._ghost = null;
      this._promoOpen = false;
      this._onDown = this._onDown.bind(this);
      this._onMove = this._onMove.bind(this);
      this._onUp = this._onUp.bind(this);
      this.root.classList.add("cb-host");
      this.root.addEventListener("pointerdown", this._onDown);
      this.root.addEventListener("pointermove", this._onMove);
      this.root.addEventListener("pointerup", this._onUp);
      this.root.addEventListener("pointercancel", this._onUp);
      this.root.addEventListener("contextmenu", (e) => e.preventDefault());
      this._ro = new ResizeObserver(() => this._syncPieceSize());
      this._ro.observe(this.root);
      this.render();
    }

    setPosition(fen, lastMove) {
      const prev = this.fen;
      this.fen = fen;
      this.lastMove = lastMove || null;
      this.selected = null;
      this.legal = [];
      this.render();
      if (lastMove && lastMove.from && lastMove.to && prev) {
        const self = this;
        requestAnimationFrame(function () { self._animateLast(lastMove); });
      }
    }

    setFlipped(v) { this.flipped = !!v; this.render(); }
    setHighlights(list) { this.highlights = list || []; this.render(); }
    clearSelection() { this.selected = null; this.legal = []; this.render(); }
    setArrows(list) { this.arrows = list || []; this._drawArrows(); }
    setTheme(id) {
      const ok = THEMES.some((t) => t.id === id) ? id : "green";
      saveTheme(ok);
      if (this.root) this.root.setAttribute("data-theme", ok);
    }

    _animateLast(mv) {
      try {
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      } catch (e) {}
      const piece = this.root.querySelector('[data-sq="' + mv.to + '"] .cb-piece');
      const fromBtn = this.root.querySelector('[data-sq="' + mv.from + '"]');
      if (!piece || !fromBtn) return;
      const a = fromBtn.getBoundingClientRect();
      const b = piece.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      piece.style.transition = "none";
      piece.style.transform = "translate(" + dx + "px," + dy + "px)";
      requestAnimationFrame(function () {
        piece.style.transition = "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)";
        piece.style.transform = "";
      });
    }

    _sqCenter(name) {
      const file = "abcdefgh".indexOf(name[0]);
      const rank = parseInt(name[1], 10) - 1;
      const f = this.flipped ? 7 - file : file;
      const r = this.flipped ? rank : 7 - rank;
      return { x: f + 0.5, y: r + 0.5 };
    }

    _drawArrows() {
      const sizer = this.root.querySelector(".cb-sizer");
      if (!sizer) return;
      let svg = sizer.querySelector(".cb-arrows");
      if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "cb-arrows");
        svg.setAttribute("viewBox", "0 0 8 8");
        svg.setAttribute("preserveAspectRatio", "none");
        sizer.appendChild(svg);
      }
      const ns = "http://www.w3.org/2000/svg";
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const defs = document.createElementNS(ns, "defs");
      const mark = document.createElementNS(ns, "marker");
      mark.setAttribute("id", "cb-ah-" + (this.root.id || "b"));
      mark.setAttribute("viewBox", "0 0 10 10");
      mark.setAttribute("refX", "8");
      mark.setAttribute("refY", "5");
      mark.setAttribute("markerWidth", "4");
      mark.setAttribute("markerHeight", "4");
      mark.setAttribute("orient", "auto-start-reverse");
      const tip = document.createElementNS(ns, "path");
      tip.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
      tip.setAttribute("fill", "#e8c84a");
      mark.appendChild(tip);
      defs.appendChild(mark);
      svg.appendChild(defs);
      const mid = mark.getAttribute("id");
      for (const a of this.arrows || []) {
        if (!a || !a.from || !a.to) continue;
        const s = this._sqCenter(a.from);
        const e = this._sqCenter(a.to);
        const line = document.createElementNS(ns, "line");
        line.setAttribute("x1", s.x);
        line.setAttribute("y1", s.y);
        line.setAttribute("x2", e.x);
        line.setAttribute("y2", e.y);
        line.setAttribute("stroke", a.color || "#e8c84a");
        line.setAttribute("stroke-width", a.width || 0.18);
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("marker-end", "url(#" + mid + ")");
        line.setAttribute("opacity", a.opacity || 0.92);
        svg.appendChild(line);
      }
    }

    _syncPieceSize() {
      const sq = this.root.querySelector(".cb-sq");
      if (!sq) return;
      const w = sq.getBoundingClientRect().width;
      if (w) this.root.style.setProperty("--piece-size", Math.max(16, Math.round(w * 0.84)) + "px");
    }

    _movesFrom(sq) {
      const chess = parseFenSafe(this.fen);
      return chess.moves({ square: sq, verbose: true });
    }

    _materialHTML(chess) {
      if (!this.showMaterial) return { top: "", bottom: "" };
      const cur = countPieces(chess);
      const score = materialScore(cur);
      const us = this.flipped ? "b" : "w";
      const them = us === "w" ? "b" : "w";
      const weTook = missing(them, cur);   /* opponent's missing pieces */
      const theyTook = missing(us, cur);
      const ourLead = us === "w" ? score.d : -score.d;
      function row(pieces, lead, cls) {
        const imgs = pieces.map((t) => {
          const color = cls === "ours" ? them : us;
          return '<img class="cb-cap" alt="" src="' + pieceSrc(color, t) + '">';
        }).join("");
        const tag = lead > 0 ? '<span class="cb-lead">+' + lead + "</span>" : (lead < 0 && cls === "theirs" ? "" : (lead === 0 ? "" : ""));
        /* show +N on the side that's ahead */
        const show = (cls === "ours" && lead > 0) || (cls === "theirs" && lead < 0);
        return '<div class="cb-material ' + cls + '">' + imgs + (show ? '<span class="cb-lead">+' + Math.abs(lead) + "</span>" : "") + "</div>";
      }
      return { top: row(theyTook, ourLead, "theirs"), bottom: row(weTook, ourLead, "ours") };
    }

    render() {
      const chess = parseFenSafe(this.fen);
      this.fen = chess.fen(); /* normalize after a bad load so we never silently show start pos as "this fen" */
      const files = this.flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
      const ranks = this.flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
      const last = this.lastMove || {};
      const hi = {};
      for (const h of this.highlights) {
        if (!h || !h.square) continue;
        if (!hi[h.square]) hi[h.square] = [];
        hi[h.square].push(h.kind || "hint");
      }
      let kingSq = null;
      try {
        if (chess.in_check()) {
          const turn = chess.turn();
          const board = chess.board();
          for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
              const p = board[r][f];
              if (p && p.type === "k" && p.color === turn) kingSq = sqName(f, 7 - r);
            }
          }
        }
      } catch (e) {}
      const mat = this._materialHTML(chess);
      const theme = loadTheme();
      let html = '<div class="cb-root" data-theme="' + theme + '">';
      html += mat.top;
      html += '<div class="cb-sizer"><div class="cb-board" role="grid" aria-label="Chess board">';
      const nearFile = this.flipped ? 0 : 7; /* h-file or a-file on the right? coords: file on near rank, rank on left file */
      const leftFile = this.flipped ? 7 : 0;
      const nearRank = this.flipped ? 7 : 0;
      for (const r of ranks) {
        for (const f of files) {
          const name = sqName(f, r);
          const dark = (f + r) % 2 === 0;
          const piece = chess.get(name);
          const classes = ["cb-sq", dark ? "dark" : "light"];
          if (this.selected === name) classes.push("selected");
          if (last.from === name || last.to === name) classes.push("last");
          if (kingSq === name) classes.push("hi-check");
          if (hi[name]) classes.push.apply(classes, hi[name].map((k) => "hi-" + k));
          const isLegal = this.legal.some((m) => m.to === name);
          if (isLegal) classes.push(piece ? "legal-capture" : "legal");
          html += '<button type="button" class="' + classes.join(" ") + '" data-sq="' + name + '" aria-label="' + name + '">';
          if (f === leftFile) html += '<span class="cb-coord rank">' + (r + 1) + "</span>";
          if (r === nearRank) html += '<span class="cb-coord file">' + "abcdefgh"[f] + "</span>";
          if (piece) {
            const key = piece.color + piece.type.toUpperCase();
            html += '<img class="cb-piece ' + piece.color + '" alt="' + key + '" draggable="false" src="' + pieceSrc(piece.color, piece.type) + '">';
          }
          html += "</button>";
        }
      }
      html += "</div></div>";
      html += mat.bottom + "</div>";
      this.root.innerHTML = html;
      this._syncPieceSize();
      this._drawArrows();
    }

    _squareAtPoint(x, y) {
      const el = document.elementFromPoint(x, y);
      const btn = el && el.closest ? el.closest("[data-sq]") : null;
      return btn ? btn.getAttribute("data-sq") : null;
    }
    _clearGhost() {
      if (this._ghost) { this._ghost.remove(); this._ghost = null; }
      const dragging = this.root.querySelector(".cb-sq.dragging");
      if (dragging) dragging.classList.remove("dragging");
    }

    _onDown(e) {
      if (e.button != null && e.button !== 0) return;
      if (this._promoOpen) return;
      if (e.target.closest && e.target.closest(".cb-promo")) return;
      const btn = e.target.closest("[data-sq]");
      if (!btn) return;
      if (!this.canMove()) return;
      const sq = btn.getAttribute("data-sq");
      const chess = parseFenSafe(this.fen);
      const piece = chess.get(sq);

      if (this.selected && this.legal.some((m) => m.to === sq)) {
        this._drag = { from: this.selected, clickTo: sq, startX: e.clientX, startY: e.clientY, dragging: false, pointerId: e.pointerId };
        try { this.root.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }
      if (piece && piece.color === chess.turn()) {
        this.selected = sq;
        this.legal = chess.moves({ square: sq, verbose: true });
        this.render();
        this._drag = {
          from: sq, startX: e.clientX, startY: e.clientY, dragging: false,
          color: piece.color, typ: piece.type, pointerId: e.pointerId
        };
        try { this.root.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
        return;
      }
      this._drag = { from: sq, startX: e.clientX, startY: e.clientY, dragging: false, deselect: true, pointerId: e.pointerId };
    }

    _onMove(e) {
      if (!this._drag) return;
      const dx = e.clientX - this._drag.startX;
      const dy = e.clientY - this._drag.startY;
      if (!this._drag.dragging && dx * dx + dy * dy > 64) {
        if (this._drag.deselect || this._drag.clickTo) return;
        this._drag.dragging = true;
        const fromBtn = this.root.querySelector('[data-sq="' + this._drag.from + '"]');
        if (fromBtn) fromBtn.classList.add("dragging");
        this._ghost = document.createElement("img");
        this._ghost.className = "cb-piece ghost " + this._drag.color;
        this._ghost.src = pieceSrc(this._drag.color, this._drag.typ);
        this._ghost.alt = "";
        this._ghost.draggable = false;
        document.body.appendChild(this._ghost);
      }
      if (this._drag.dragging && this._ghost) {
        this._ghost.style.left = e.clientX + "px";
        this._ghost.style.top = e.clientY + "px";
      }
    }

    _onUp(e) {
      if (!this._drag) return;
      const drag = this._drag;
      this._drag = null;
      try { this.root.releasePointerCapture(drag.pointerId); } catch (_) {}
      const to = this._squareAtPoint(e.clientX, e.clientY);
      this._clearGhost();
      if (drag.dragging) {
        if (to) this._tryMove(drag.from, to);
        else this.render();
        return;
      }
      if (drag.clickTo) { this._tryMove(drag.from, drag.clickTo); return; }
      if (drag.deselect) { this.selected = null; this.legal = []; this.render(); }
    }

    async _tryMove(from, to) {
      if (this._promoOpen) return;
      let dests = this.legal.filter((m) => m.from === from && m.to === to);
      if (!dests.length) dests = this._movesFrom(from).filter((m) => m.to === to);
      if (!dests.length) { this.render(); return; }
      let move = dests[0];
      if (dests.some((m) => m.promotion)) {
        const chess = parseFenSafe(this.fen);
        const piece = chess.get(from);
        const promo = await this._askPromo(piece ? piece.color : "w");
        if (!promo) { this.render(); return; }
        move = dests.find((m) => m.promotion === promo) || dests.find((m) => m.promotion === "q") || dests[0];
      }
      this.selected = null;
      this.legal = [];
      this.onMove({ from: from, to: move.to, promotion: move.promotion });
    }

    _askPromo(color) {
      return new Promise((resolve) => {
        this._promoOpen = true;
        const host = this.root.querySelector(".cb-sizer") || this.root;
        const overlay = document.createElement("div");
        overlay.className = "cb-promo";
        const keys = ["q", "r", "b", "n"];
        overlay.innerHTML =
          '<div class="cb-promo-card" role="dialog" aria-label="Choose promotion piece">' +
          keys.map((k) => '<button type="button" data-p="' + k + '" aria-label="Promote to ' + k + '"><img alt="' + k + '" src="' + pieceSrc(color, k) + '"></button>').join("") +
          "</div>";
        host.appendChild(overlay);
        const finish = (val) => {
          if (!this._promoOpen) return;
          this._promoOpen = false;
          overlay.remove();
          resolve(val);
        };
        overlay.addEventListener("click", (ev) => {
          const b = ev.target.closest("[data-p]");
          if (!b) return;
          finish(b.getAttribute("data-p"));
        });
      });
    }

    metrics() {
      const board = this.root.querySelector(".cb-board");
      const sizer = this.root.querySelector(".cb-sizer");
      const squares = Array.from(this.root.querySelectorAll(".cb-sq"));
      const br = board ? board.getBoundingClientRect() : null;
      const sr = sizer ? sizer.getBoundingClientRect() : null;
      const cells = squares.map((sq) => {
        const r = sq.getBoundingClientRect();
        return { sq: sq.getAttribute("data-sq"), w: r.width, h: r.height, x: r.x, y: r.y };
      });
      const ranks = Array.from(this.root.querySelectorAll(".cb-coord.rank")).map((s) => s.textContent);
      const files = Array.from(this.root.querySelectorAll(".cb-coord.file")).map((s) => s.textContent);
      return {
        board: br ? { w: br.width, h: br.height, ratio: br.width / (br.height || 1) } : null,
        sizer: sr ? { w: sr.width, h: sr.height, ratio: sr.width / (sr.height || 1) } : null,
        squareCount: squares.length,
        cells, ranks, files, flipped: this.flipped
      };
    }
  }

  BoardUI.themes = THEMES;
  BoardUI.loadTheme = loadTheme;
  BoardUI.setTheme = saveTheme;
  BoardUI.pieceSrc = pieceSrc;
  window.BoardUI = BoardUI;
})();
