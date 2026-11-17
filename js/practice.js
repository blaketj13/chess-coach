/* Hands-on opening practice: Guided and Solo, every branch covered in 4–8-move chunks.
   Steps are tagged so a later “thinking out loud” flow can insert notice / candidates / why / reveal
   in front of a move without changing today’s play-the-move lessons. */
(function () {
  const STEP = { MOVE: "move", NOTICE: "notice", CANDIDATES: "candidates", WHY: "why", REVEAL: "reveal" };
  window.SCSteps = { types: STEP };
  function tagStep(m) {
    if (!m) return m;
    if (!m.type) m.type = STEP.MOVE;
    return m;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function short(s, n) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    const cut = s.split(/(?<=\.)\s/)[0];
    if (cut.length <= (n || 90)) return cut;
    return s.slice(0, n || 90).replace(/\s+\S*$/, "") + "…";
  }
  function words8(s) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    const w = t.split(" ").filter(Boolean);
    return w.length <= 8 ? t : w.slice(0, 8).join(" ");
  }
  function squaresIn(text) {
    const out = [];
    const re = /\b([a-h][1-8])\b/g;
    let m;
    while ((m = re.exec(String(text || "")))) out.push(m[1]);
    return out;
  }
  function mainLine(ch) {
    const line = [];
    let node = (ch && ch.tree) || { replies: [] };
    for (;;) {
      const reps = node.replies || [];
      const main = reps.find((r) => r.main) || reps[0];
      if (!main) break;
      line.push(main);
      node = main;
    }
    return line;
  }
  function pathKey(moves) {
    return (moves || []).map(function (m) { return m.uci; }).join(" ");
  }
  function usKeysInTree(ch) {
    const keys = [];
    function walk(node, path) {
      ((node && node.replies) || []).forEach(function (r) {
        const p = path.concat([r]);
        if (r.side === "us") keys.push(pathKey(p));
        walk(r, p);
      });
    }
    walk((ch && ch.tree) || { replies: [] }, []);
    return keys;
  }

  /* Walk every branch. Main spine is sliced into 4–8 of our moves; each side branch is its own run. */
  function chunks(opening, ch) {
    const out = [];
    const OUR_TARGET = 5;
    const OUR_MAX = 8;

    function addChunk(prefix, moves) {
      if (!moves || !moves.length) return;
      out.push({
        startPath: prefix.slice(),
        moves: moves.slice().map(tagStep),
        start: prefix.length,
        end: prefix.length + moves.length
      });
    }

    function sliceSpine(prefix, spine) {
      let i = 0;
      while (i < spine.length) {
        let ours = 0;
        let j = i;
        while (j < spine.length) {
          if (spine[j].side === "us") ours++;
          j++;
          if (ours >= OUR_TARGET && (j === spine.length || spine[j].side !== "us")) break;
          if (ours >= OUR_MAX) break;
        }
        if (j === i) j = i + 1;
        addChunk(prefix, spine.slice(i, j));
        prefix = prefix.concat(spine.slice(i, j));
        i = j;
      }
    }

    function walk(node, prefix) {
      const reps = (node && node.replies) || [];
      if (!reps.length) return;
      const main = reps.find(function (r) { return r.main; }) || reps[0];
      const spine = [];
      let n = node;
      while (true) {
        const rs = (n.replies || []);
        if (!rs.length) break;
        const m = rs.find(function (r) { return r.main; }) || rs[0];
        spine.push(m);
        n = m;
      }
      sliceSpine(prefix, spine);
      function sides(atNode, pathSoFar) {
        const rs = atNode.replies || [];
        const m = rs.find(function (r) { return r.main; }) || rs[0];
        rs.forEach(function (r) {
          if (r === m) return;
          walk({ replies: [r] }, pathSoFar);
        });
      }
      sides(node, prefix);
      let path = prefix.slice();
      for (let i = 0; i < spine.length; i++) {
        path = path.concat([spine[i]]);
        sides(spine[i], path);
      }
    }

    walk((ch && ch.tree) || { replies: [] }, []);
    return out;
  }

  function coverage(opening, ch) {
    const all = usKeysInTree(ch);
    const covered = [];
    const parts = chunks(opening, ch);
    parts.forEach(function (part) {
      const path = (part.startPath || []).slice();
      (part.moves || []).forEach(function (m) {
        path.push(m);
        if (m.side === "us") covered.push(pathKey(path));
      });
    });
    const allSet = {};
    all.forEach(function (k) { allSet[k] = true; });
    const covSet = {};
    covered.forEach(function (k) { covSet[k] = true; });
    const missing = all.filter(function (k) { return !covSet[k]; });
    const extra = covered.filter(function (k, i) { return covered.indexOf(k) !== i; });
    return {
      total: all.length,
      covered: Object.keys(covSet).length,
      chunks: parts.length,
      ok: missing.length === 0 && all.length === Object.keys(covSet).length,
      missing: missing,
      duplicates: extra
    };
  }

  /* Simulate Guided and Solo through every chunk; every us-move is reached; no dead end. */
  function walkThrough(opening, ch, mode) {
    const parts = chunks(opening, ch);
    const cov = coverage(opening, ch);
    const steps = [];
    const ends = [];
    parts.forEach(function (part, i) {
      const us = (part.moves || []).filter(function (m) { return m.side === "us"; }).length;
      steps.push({ i: i, us: us, more: i + 1 < parts.length });
      if (us < 1 && (part.moves || []).length === 0) ends.push("empty chunk " + i);
    });
    if (!parts.length && usKeysInTree(ch).length) ends.push("no chunks but tree has moves");
    if (!cov.ok) ends.push("uncovered moves: " + cov.missing.length);
    const last = parts[parts.length - 1];
    if (parts.length && last && steps[steps.length - 1].more) ends.push("last chunk has no terminal");
    return { mode: mode || "guided", ok: ends.length === 0 && cov.ok, issues: ends, coverage: cov, chunks: parts.length };
  }

  function auditAll() {
    const openings = (window.Openings && window.Openings.openings && window.Openings.openings()) || [];
    const issues = [];
    let chapters = 0, usMoves = 0, chunkCount = 0;
    openings.forEach(function (o) {
      (o.chapters || []).forEach(function (ch) {
        chapters++;
        const cov = coverage(o, ch);
        usMoves += cov.total;
        chunkCount += cov.chunks;
        const g = walkThrough(o, ch, "guided");
        const s = walkThrough(o, ch, "solo");
        if (!cov.ok) issues.push({ opening: o.id, chapter: ch.id, issue: "coverage " + cov.covered + "/" + cov.total, missing: cov.missing.slice(0, 3) });
        if (!g.ok) issues.push({ opening: o.id, chapter: ch.id, issue: "guided: " + (g.issues[0] || "fail") });
        if (!s.ok) issues.push({ opening: o.id, chapter: ch.id, issue: "solo: " + (s.issues[0] || "fail") });
        /* Continue exists whenever a later chunk remains. */
        const parts = chunks(o, ch);
        for (let i = 0; i < parts.length; i++) {
          const hasContinue = i + 1 < parts.length;
          const isLast = i === parts.length - 1;
          if (!hasContinue && !isLast) issues.push({ opening: o.id, chapter: ch.id, issue: "dead end at chunk " + i });
        }
      });
    });
    return { ok: issues.length === 0, issues: issues, chapters: chapters, usMoves: usMoves, chunks: chunkCount, openings: openings.length };
  }

  function applyUci(chess, uci) {
    if (!uci || uci.length < 4) return null;
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  function fenAfter(moves) {
    const c = new Chess();
    for (let i = 0; i < (moves || []).length; i++) applyUci(c, moves[i].uci);
    return c.fen();
  }
  function uciOf(mv) {
    return mv.from + mv.to + (mv.promotion || "");
  }

  function start(root, opts) {
    const opening = opts.opening;
    const ch = opts.chapter;
    const mode = opts.mode === "solo" ? "solo" : "guided";
    const parts = chunks(opening, ch);
    const ourColor = opening.color === "black" ? "b" : "w";
    let chunkI = 0;
    let phase = "learn";
    let board = null;
    let chess = new Chess();
    let iIn = 0; /* index into current chunk.moves, position is after startPath + iIn */
    let busy = false;
    let locked = false;
    let misses = [];
    let hits = 0;
    let retryOnly = null; /* array of us-path keys to retry */
    const solo = mode === "solo";

    function totalUs() {
      return usKeysInTree(ch).length;
    }
    function knownUs() {
      const p = window.Openings && window.Openings.chapterProgress(opening, ch);
      return (p && p.known) || 0;
    }
    function currentLine() {
      const part = parts[chunkI] || { startPath: [], moves: [] };
      return (part.startPath || []).concat(part.moves || []);
    }
    function posAt(prefixLen) {
      const line = currentLine();
      const c = new Chess();
      for (let i = 0; i < prefixLen && i < line.length; i++) applyUci(c, line[i].uci);
      return c;
    }
    function absIndex() {
      const part = parts[chunkI] || { startPath: [] };
      return (part.startPath || []).length + iIn;
    }

    function paintShell() {
      const part = parts[chunkI] || { startPath: [], moves: [] };
      const usInChunk = (part.moves || []).filter(function (m) { return m.side === "us"; }).length;
      const title = solo ? "Solo" : "Guided";
      if (window.AppChrome) {
        window.AppChrome.setTitle(title);
        window.AppChrome.setBack(function () { if (opts.onBack) opts.onBack(); });
      }
      root.innerHTML =
        "<div class=\"op-page play-shell compact-lesson\">" +
        "<div class=\"thin-progress\" id=\"pr-bar\"><span></span></div>" +
        "<div id=\"pr-board\" class=\"mini-board\"></div>" +
        "<div id=\"pr-cue\" class=\"cue-bar\"></div>" +
        "<div id=\"pr-why\" class=\"why-panel\" hidden></div>" +
        "<div id=\"pr-extra\"></div>" +
        "<div class=\"nav-row\" id=\"pr-nav\"></div>" +
        "</div>";
      board = new window.BoardUI($("#pr-board", root), {
        flipped: opening.color === "black",
        showMaterial: true,
        canMove: function () { return !busy && !locked && chess.turn() === ourColor; },
        onMove: onUserMove
      });
      updateBar();
    }

    function updateBar() {
      const bar = $("#pr-bar span", root);
      const tot = Math.max(1, totalUs());
      const done = Math.min(tot, knownUs() + hits);
      if (bar) bar.style.width = Math.round((done / tot) * 100) + "%";
    }

    function setCue(text, why, squares, arrows) {
      const cue = $("#pr-cue", root);
      const whyBox = $("#pr-why", root);
      if (solo) {
        cue.innerHTML = "";
        whyBox.hidden = true;
        if (board.setHighlights) board.setHighlights([]);
        if (board.setArrows) board.setArrows([]);
        return;
      }
      const line = words8(text);
      cue.innerHTML = line
        ? "<span>" + esc(line) + "</span>" + (why ? " <button type=\"button\" class=\"text-btn why-btn\" id=\"pr-why-btn\">Why?</button>" : "")
        : "";
      whyBox.hidden = true;
      whyBox.textContent = why || "";
      const btn = $("#pr-why-btn", root);
      if (btn) btn.addEventListener("click", function () { whyBox.hidden = !whyBox.hidden; });
      const hi = (squares || []).map(function (sq) { return { square: sq, kind: "key" }; });
      if (board.setHighlights) board.setHighlights(hi);
      if (board.setArrows) board.setArrows(arrows || []);
    }

    function showNav(buttons) {
      const nav = $("#pr-nav", root);
      nav.innerHTML = buttons.map(function (b) {
        return "<button type=\"button\" class=\"" + (b.primary ? "primary" : "") + "\" data-act=\"" + b.act + "\">" + esc(b.label) + "</button>";
      }).join("");
      nav.querySelectorAll("[data-act]").forEach(function (el) {
        el.addEventListener("click", function () { handleAct(el.getAttribute("data-act")); });
      });
    }

    function guideFor(nxt) {
      if (solo || !nxt) return;
      const from = nxt.uci.slice(0, 2);
      const to = nxt.uci.slice(2, 4);
      const sq = [from, to].concat(squaresIn(nxt.idea || ch.mnemonic));
      const arrows = [{ from: from, to: to, color: "#e8c84a" }];
      setCue(nxt.idea || "Your move.", nxt.idea, sq, arrows);
      if (board.setHighlights) {
        board.setHighlights([{ square: from, kind: "hint" }, { square: to, kind: "key" }]);
      }
    }

    function applyMoveAt(lineIndex, animate) {
      const line = currentLine();
      const mv = line[lineIndex];
      if (!mv) return;
      const last = applyUci(chess, mv.uci);
      iIn = lineIndex - (parts[chunkI].startPath || []).length + 1;
      if (iIn < 0) iIn = 0;
      if (board) board.setPosition(chess.fen(), animate === false ? null : (last || { from: mv.uci.slice(0, 2), to: mv.uci.slice(2, 4) }));
    }

    function startChunk() {
      paintShell();
      const part = parts[chunkI];
      chess = new Chess();
      (part.startPath || []).forEach(function (m) { applyUci(chess, m.uci); });
      iIn = 0;
      board.setPosition(chess.fen(), null);
      busy = false;
      locked = false;
      if (!solo) setCue(ch.mnemonic || "Play the plan.", ch.mnemonic, squaresIn(ch.mnemonic));
      else setCue("", "", []);
      showNav(solo ? [] : [{ act: "show", label: "Show" }]);
      continueAuto();
    }

    function continueAuto() {
      if (phase === "wrap") return;
      const part = parts[chunkI];
      if (iIn >= (part.moves || []).length) return finishChunk();
      const nxt = part.moves[iIn];
      if (!nxt) return finishChunk();
      if (nxt.side !== "us") {
        busy = true;
        locked = true;
        if (!solo) setCue("", "", []);
        setTimeout(function () {
          const lineIndex = (part.startPath || []).length + iIn;
          applyMoveAt(lineIndex, true);
          busy = false;
          locked = false;
          continueAuto();
        }, 320);
        return;
      }
      if (retryOnly) {
        const path = pathKey((part.startPath || []).concat(part.moves.slice(0, iIn + 1)));
        if (retryOnly.indexOf(path) < 0) {
          /* auto-play known good moves during a miss-retry */
          const lineIndex = (part.startPath || []).length + iIn;
          applyMoveAt(lineIndex, true);
          hits++;
          continueAuto();
          return;
        }
      }
      busy = false;
      locked = false;
      if (solo) {
        setCue("", "", []);
        showNav([]);
      } else {
        guideFor(nxt);
        maybeAskIdea(nxt);
        showNav([{ act: "show", label: "Show" }]);
      }
    }

    function maybeAskIdea(nxt) {
      const extra = $("#pr-extra", root);
      extra.innerHTML = "";
      if (solo || phase !== "learn") return;
      const part = parts[chunkI];
      const firstUs = (part.moves || []).find(function (m) { return m.side === "us"; });
      if (!firstUs || firstUs !== nxt) return;
      const plan = words8(ch.mnemonic || nxt.idea);
      if (!plan) return;
      const choices = [{ id: "plan", label: plan, ok: true }];
      const keys = ch.themes ? Object.keys(ch.themes) : [];
      keys.forEach(function (k) {
        if (choices.length >= 3) return;
        const lab = words8(k);
        if (lab && lab !== plan) choices.push({ id: k, label: lab, ok: false });
      });
      if (choices.length < 2) return;
      for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = choices[i]; choices[i] = choices[j]; choices[j] = t;
      }
      extra.innerHTML = "<div class=\"idea-chips\" id=\"pr-ideas\"></div>";
      const box = $("#pr-ideas", extra);
      choices.forEach(function (c) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "chip-choice";
        b.textContent = c.label;
        b.addEventListener("click", function () {
          Array.prototype.forEach.call(box.querySelectorAll(".chip-choice"), function (x) { x.disabled = true; });
          b.classList.add(c.ok ? "ok" : "bad");
        });
        box.appendChild(b);
      });
    }

    function mark(correct, pathUci) {
      if (window.Openings && window.Openings.markBranch) {
        const key = window.Openings.branchKey(opening.id, ch.id, pathUci || "");
        window.Openings.markBranch(key, !!correct);
      }
    }
    function pathUciToUs() {
      const part = parts[chunkI];
      return pathKey((part.startPath || []).concat((part.moves || []).slice(0, iIn + 1)));
    }

    function shake() {
      const el = $("#pr-board", root);
      if (!el) return;
      el.classList.remove("shake");
      void el.offsetWidth;
      el.classList.add("shake");
    }

    function onUserMove(spec) {
      if (busy || locked) return;
      const part = parts[chunkI];
      const nxt = part.moves[iIn];
      if (!nxt || nxt.side !== "us") return;
      const preview = new Chess(chess.fen());
      const mv = preview.move({ from: spec.from, to: spec.to, promotion: spec.promotion || "q" });
      if (!mv) return;
      const played = uciOf(mv);
      const book = nxt.uci;
      const isBook = played === book;
      const alts = findAlts(played);
      const isAlt = !isBook && alts.indexOf(played) >= 0;

      if (solo) {
        if (isBook) {
          mark(true, pathUciToUs());
          chess.move(mv);
          iIn++;
          hits++;
          board.setPosition(chess.fen(), { from: mv.from, to: mv.to, promotion: mv.promotion, san: mv.san });
          updateBar();
          locked = true;
          setTimeout(function () { locked = false; continueAuto(); }, 200);
          return;
        }
        /* Miss: shake, count it, play the book move, keep going. */
        shake();
        misses.push({ san: nxt.san, idea: nxt.idea, path: pathUciToUs(), uci: nxt.uci });
        mark(false, pathUciToUs());
        board.setPosition(chess.fen(), null);
        locked = true;
        busy = true;
        setTimeout(function () {
          const lineIndex = (part.startPath || []).length + iIn;
          applyMoveAt(lineIndex, true);
          busy = false;
          locked = false;
          continueAuto();
        }, 420);
        return;
      }

      /* Guided */
      function accept(kind) {
        if (kind === "book" || kind === "alt") {
          if (kind === "book") {
            mark(true, pathUciToUs());
            chess.move(mv);
            iIn++;
            hits++;
            board.setPosition(chess.fen(), { from: mv.from, to: mv.to, promotion: mv.promotion, san: mv.san });
            setCue("That's it.", nxt.idea, [], []);
          } else {
            setCue("Works. Book prefers " + nxt.san + ".", nxt.idea, [], [{ from: nxt.uci.slice(0, 2), to: nxt.uci.slice(2, 4), color: "#3d8b6e" }]);
            mark(true, pathUciToUs());
            showNav([{ act: "continue-book", label: "Continue", primary: true }, { act: "playout", label: "Play it out" }]);
            locked = true;
            busy = true;
            window._prSnap = function () {
              chess = posAt((part.startPath || []).length + iIn);
              applyMoveAt((part.startPath || []).length + iIn, true);
              hits++;
              locked = false;
              busy = false;
              continueAuto();
            };
            return;
          }
          updateBar();
          locked = true;
          setTimeout(function () { locked = false; continueAuto(); }, 280);
          return;
        }
      }

      if (isBook) return accept("book");
      if (isAlt) return accept("alt");

      const review = opts.reviewMove;
      if (review) {
        busy = true;
        Promise.resolve(review(chess.fen(), mv.san)).then(function (r) {
          busy = false;
          const drop = r && typeof r.drop === "number" ? r.drop : 999;
          if (r && drop < 80) return accept("alt");
          missGuided(nxt);
        }).catch(function () { busy = false; missGuided(nxt); });
        return;
      }
      missGuided(nxt);
    }

    function findAlts() {
      const line = currentLine();
      const at = absIndex();
      let node = ch.tree || { replies: [] };
      for (let k = 0; k < at; k++) {
        const u = line[k] && line[k].uci;
        const hit = (node.replies || []).find(function (r) { return r.uci === u; });
        if (!hit) return [];
        node = hit;
      }
      return (node.replies || []).filter(function (r) { return r.side === "us"; }).map(function (r) { return r.uci; });
    }

    function missGuided(nxt) {
      const extra = $("#pr-extra", root);
      extra.innerHTML = "";
      board.setPosition(chess.fen(), null);
      board.setArrows([{ from: nxt.uci.slice(0, 2), to: nxt.uci.slice(2, 4), color: "#3d8b6e" }]);
      setCue("The move is " + nxt.san + ".", nxt.idea, [nxt.uci.slice(2, 4)], [{ from: nxt.uci.slice(0, 2), to: nxt.uci.slice(2, 4) }]);
      mark(false, pathUciToUs());
      showNav([{ act: "show", label: "Show", primary: true }, { act: "try", label: "Try again" }]);
    }

    function handleAct(act) {
      const part = parts[chunkI];
      if (act === "show") {
        const nxt = part.moves[iIn];
        if (!nxt || nxt.side !== "us") return;
        locked = true;
        busy = true;
        applyMoveAt((part.startPath || []).length + iIn, true);
        mark(false, pathUciToUs());
        if (!solo) setCue("It was " + nxt.san + ".", nxt.idea, [], []);
        setTimeout(function () { locked = false; busy = false; continueAuto(); }, 400);
        return;
      }
      if (act === "try") {
        $("#pr-extra", root).innerHTML = "";
        board.setPosition(chess.fen(), null);
        locked = false;
        busy = false;
        showNav([{ act: "show", label: "Show" }]);
        const nxt = part.moves[iIn];
        if (nxt) guideFor(nxt);
        return;
      }
      if (act === "continue-book") {
        if (window._prSnap) window._prSnap();
        return;
      }
      if (act === "playout") {
        if (opts.onPlayOut) opts.onPlayOut(chess.fen(), opening.color, ch.mnemonic);
        return;
      }
      if (act === "drill") {
        phase = "drill";
        startChunk();
        return;
      }
      if (act === "continue" || act === "next-chunk") {
        chunkI++;
        phase = "learn";
        retryOnly = null;
        if (chunkI >= parts.length) return allDone();
        startChunk();
        return;
      }
      if (act === "done") {
        allDone();
        return;
      }
      if (act === "again") {
        phase = "learn";
        retryOnly = null;
        misses = [];
        hits = 0;
        startChunk();
        return;
      }
      if (act === "retry-misses") {
        if (!misses.length) return allDone();
        retryOnly = misses.map(function (m) { return m.path; });
        misses = [];
        chunkI = 0;
        phase = "learn";
        startChunk();
        return;
      }
    }

    function finishChunk() {
      const cameFrom = phase;
      phase = "wrap";
      locked = true;
      busy = false;
      const more = chunkI + 1 < parts.length;
      const extra = $("#pr-extra", root);
      if (solo && cameFrom !== "drill") {
        const us = (parts[chunkI].moves || []).filter(function (m) { return m.side === "us"; }).length;
        const ok = Math.max(0, us - misses.length);
        setCue("", "", []);
        extra.innerHTML = "<p class=\"cue-bar\">" + esc(String(ok) + " / " + us) + (misses.length ? " · missed " + misses.map(function (m) { return m.san; }).join(", ") : "") + "</p>";
        const buttons = [];
        if (more) buttons.push({ act: "continue", label: "Continue", primary: true });
        else if (misses.length) buttons.push({ act: "retry-misses", label: "Retry misses", primary: true });
        else buttons.push({ act: "done", label: "Done", primary: true });
        if (misses.length && more) buttons.push({ act: "retry-misses", label: "Retry misses" });
        buttons.push({ act: "again", label: "Again" });
        showNav(buttons);
        return;
      }
      const buttons = [];
      if (more) {
        setCue("Chunk complete.", "", []);
        extra.innerHTML = "";
        buttons.push({ act: "continue", label: "Continue", primary: true });
        if (cameFrom !== "drill") buttons.push({ act: "drill", label: "Drill" });
        buttons.push({ act: "playout", label: "Play it out" });
      } else {
        setCue("Chapter complete.", "", []);
        extra.innerHTML = "";
        buttons.push({ act: "done", label: "Done", primary: true });
        buttons.push({ act: "playout", label: "Play it out" });
        if (cameFrom !== "drill") buttons.push({ act: "drill", label: "Drill" });
      }
      buttons.push({ act: "again", label: "Again" });
      showNav(buttons);
    }

    function allDone() {
      phase = "wrap";
      if (opts.onComplete) opts.onComplete({ mode: mode, misses: misses.slice(), hits: hits });
    }

    if (!parts.length) {
      root.innerHTML = "<div class=\"op-page\"><p>No line in this chapter.</p></div>";
      if (window.AppChrome) window.AppChrome.setBack(function () { if (opts.onBack) opts.onBack(); });
      return;
    }
    startChunk();
  }

  window.Practice = {
    start: start,
    chunks: chunks,
    mainLine: mainLine,
    short: short,
    words8: words8,
    coverage: coverage,
    walkThrough: walkThrough,
    auditAll: auditAll,
    usKeysInTree: usKeysInTree,
    stepTypes: STEP
  };
})();
