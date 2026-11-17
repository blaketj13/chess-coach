/* Opening trainer: chapter-based trees, learn / explorer / quiz, branch-level SRS. */
(function () {
  const SRS_KEY = "sc.opening.srs.v1";
  const PROG_KEY = "sc.opening.progress.v1";

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return fallback;
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  const Openings = {
    data: null,
    srs: loadJSON(SRS_KEY, {}),
    progress: loadJSON(PROG_KEY, {}),
    view: "home", // home | opening | chapter | learn | quiz | explore
    openingId: null,
    chapterId: null,
    path: [], // nodes from root
    quizQueue: [],
    quizIndex: 0,
    quizAwaiting: null,

    async load() {
      if (this.data) return this.data;
      const base = new URL(".", document.baseURI || location.href);
      const res = await fetch(new URL("data/repertoire.json", base));
      this.data = await res.json();
      return this.data;
    },

    openings() { return (this.data && this.data.openings) || []; },
    opening(id) { return this.openings().find((o) => o.id === id); },
    chapter(oid, cid) {
      const o = this.opening(oid);
      return o && (o.chapters || []).find((c) => c.id === cid);
    },

    branchKey(oid, cid, uciPath) {
      return oid + "|" + cid + "|" + (uciPath || "").trim();
    },

    /* Collect every position where it is "our" move in a chapter tree. */
    ourPositions(opening, chapter) {
      const out = [];
      const our = opening.color === "white" ? "w" : "b";
      function walk(node, path, ply) {
        const replies = (node && node.replies) || [];
        replies.forEach((ch) => {
          const p = path.concat([ch]);
          const pathUci = p.map((n) => n.uci).join(" ");
          if (ch.side === "us") {
            out.push({
              openingId: opening.id,
              chapterId: chapter.id,
              path: p,
              pathUci: path.slice(0, -1).map((n) => n.uci).join(" "),
              move: ch,
              main: !!ch.main,
              ply: ply
            });
          }
          walk(ch, p, ply + 1);
        });
      }
      const root = chapter.tree || { replies: chapter.replies || [] };
      walk(root, [], 0);
      return out;
    },

    allBranches(opening) {
      const list = [];
      (opening.chapters || []).forEach((ch) => {
        this.ourPositions(opening, ch).forEach((p) => list.push(p));
      });
      return list;
    },

    srsRecord(key) {
      return this.srs[key] || { ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0, last: 0, known: false };
    },

    markBranch(key, correct) {
      const r = this.srsRecord(key);
      const now = Date.now();
      if (correct) {
        r.reps += 1;
        r.known = true;
        r.ease = Math.min(3.2, (r.ease || 2.5) + 0.08);
        if (r.interval <= 0) r.interval = 1;
        else if (r.interval === 1) r.interval = 3;
        else r.interval = Math.round(r.interval * r.ease);
        r.due = now + r.interval * 24 * 60 * 60 * 1000;
      } else {
        r.lapses += 1;
        r.known = false;
        r.ease = Math.max(1.3, (r.ease || 2.5) - 0.2);
        r.interval = 0;
        r.due = now;
      }
      r.last = now;
      this.srs[key] = r;
      saveJSON(SRS_KEY, this.srs);
      return r;
    },

    chapterProgress(opening, chapter) {
      const pos = this.ourPositions(opening, chapter);
      let known = 0, due = 0;
      pos.forEach((p) => {
        const r = this.srsRecord(this.branchKey(opening.id, chapter.id, p.pathUci));
        if (r.known) known++;
        if (r.due && r.due <= Date.now() && r.reps) due++;
      });
      return { total: pos.length, known: known, due: due };
    },

    openingProgress(opening) {
      let total = 0, known = 0, due = 0;
      (opening.chapters || []).forEach((ch) => {
        const p = this.chapterProgress(opening, ch);
        total += p.total; known += p.known; due += p.due;
      });
      return { total: total, known: known, due: due };
    },

    /* Main-line first, then sidelines, for a learn/quiz order. */
    learnOrder(opening, chapter) {
      const pos = this.ourPositions(opening, chapter);
      const main = pos.filter((p) => p.main);
      const side = pos.filter((p) => !p.main);
      return main.concat(side);
    },

    dueForChapter(opening, chapter) {
      const order = this.learnOrder(opening, chapter);
      const now = Date.now();
      const due = order.filter((p) => {
        const r = this.srsRecord(this.branchKey(opening.id, chapter.id, p.pathUci));
        return !r.reps || r.due <= now;
      });
      return due.length ? due : order.filter((p) => !this.srsRecord(this.branchKey(opening.id, chapter.id, p.pathUci)).known);
    },

    fenAfter(path) {
      const c = new Chess();
      for (let i = 0; i < path.length; i++) {
        const n = path[i];
        const u = n.uci;
        const ok = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u[4] : undefined });
        if (!ok) return c.fen();
      }
      return c.fen();
    },

    /* Every "us" repertoire move in this opening that can be played from fen (by piece placement). */
    repertoireMovesAt(opening, fen) {
      const place = String(fen || "").split(" ")[0];
      const seen = {};
      const out = [];
      (opening.chapters || []).forEach((ch) => {
        this.ourPositions(opening, ch).forEach((p) => {
          const f = this.fenAfter(p.path.slice(0, -1));
          if (String(f).split(" ")[0] !== place) return;
          const u = p.move && p.move.uci;
          if (!u || seen[u]) return;
          seen[u] = true;
          out.push({
            san: p.move.san,
            uci: u,
            idea: p.move.idea || "",
            chapterId: ch.id,
            line: ch.name
          });
        });
      });
      return out;
    },

    /* Live-game helper: given UCI history and play-as color, find a matching cue. */
    liveCue(uciHistory, playAs) {
      const want = playAs === "white" ? "white" : "black";
      const hist = (uciHistory || []).join(" ");
      let best = null;
      this.openings().forEach((o) => {
        if (o.color !== want) return;
        (o.chapters || []).forEach((ch) => {
          const hits = this.ourPositions(o, ch).filter((p) => {
            const prefix = p.pathUci;
            return hist === prefix || hist === (prefix ? prefix + " " + p.move.uci : p.move.uci);
          });
          // cue when it's our move (history matches pathUci, we should play p.move)
          const at = this.ourPositions(o, ch).find((p) => p.pathUci === hist);
          if (at) {
            best = {
              opening: o,
              chapter: ch,
              next: at.move,
              text: (ch.mnemonic ? ch.mnemonic + " " : "") + (at.move.idea || "Stay in the " + o.name + " plan.")
            };
          }
        });
      });
      // If they just left the book, say so.
      if (!best) {
        this.openings().forEach((o) => {
          if (o.color !== want) return;
          (o.chapters || []).forEach((ch) => {
            const all = this.ourPositions(o, ch);
            if (all.some((p) => hist.indexOf(p.pathUci) === 0 && p.pathUci && hist.startsWith(p.pathUci))) {
              /* still somewhere in tree */
            }
          });
        });
      }
      return best;
    },

    leftBookNote(uciHistory, playAs) {
      const want = playAs === "white" ? "white" : "black";
      let inAny = false;
      let last = null;
      const hist = (uciHistory || []).join(" ");
      this.openings().forEach((o) => {
        if (o.color !== want) return;
        (o.chapters || []).forEach((ch) => {
          function walk(node, path) {
            const sofar = path.join(" ");
            if (sofar && hist !== sofar && hist.indexOf(sofar) !== 0) return;
            if (sofar === hist || hist.indexOf(sofar + " ") === 0 || !sofar) inAny = sofar === hist || !hist;
            if (sofar && hist.indexOf(sofar) === 0) last = { opening: o, chapter: ch, path: path.slice() };
            ((node && node.replies) || []).forEach((chld) => walk(chld, path.concat([chld.uci])));
          }
          walk(ch.tree || { replies: ch.replies || [] }, []);
        });
      });
      if (inAny) return null;
      if (last) {
        return {
          text: "He's left the " + last.opening.name + " lines you studied. Stick to the ideas: " + ((last.chapter && last.chapter.mnemonic) || "develop, castle, and keep the plan.")
        };
      }
      return null;
    }
  };

  Openings.situationAt = function (opening, chapter, path) {
    /* After `path` (array of nodes from root), the current node's replies. */
    const node = path.length ? path[path.length - 1] : (chapter.tree || { replies: [] });
    const replies = (node && node.replies) || [];
    const them = replies.filter((r) => r.side === "them");
    const us = replies.filter((r) => r.side === "us");
    const items = them.map((t) => {
      const answer = ((t.replies || []).find((r) => r.side === "us" && r.main) || (t.replies || []).find((r) => r.side === "us"));
      return {
        move: t,
        intent: t.intent || t.idea || t.san,
        answer: answer || null,
        reason: (answer && (answer.plan || answer.idea)) || "",
        transpositions: (answer && answer.transpositions) || t.transpositions || []
      };
    });
    const shared = [];
    if (chapter.themes) {
      Object.keys(chapter.themes).forEach((k) => shared.push({ label: k, text: chapter.themes[k] }));
    }
    const trans = [];
    items.forEach((it) => (it.transpositions || []).forEach((x) => trans.push(x)));
    return { items: items, our: us, shared: shared, transpositions: trans, mnemonic: chapter.mnemonic };
  };

  Openings.siblingsOfLastThem = function (path) {
    if (!path.length) return [];
    const last = path[path.length - 1];
    if (last.side !== "them") return [];
    /* parent replies */
    return [];
  };

  Openings.recognitionBank = function () {
    const bank = [];
    this.openings().forEach((o) => {
      (o.chapters || []).forEach((ch) => {
        this.ourPositions(o, ch).forEach((p) => {
          if (!p.path || p.path.length < 4) return;
          const before = p.path.slice(0, -1);
          const lastThem = before.length && before[before.length - 1].side === "them" ? before[before.length - 1] : null;
          const fen = this.fenAfter(before);
          bank.push({
            openingId: o.id,
            opening: o.name,
            chapterId: ch.id,
            chapter: ch.name,
            fen: fen,
            path: before,
            pathUci: p.pathUci,
            move: p.move,
            intent: (lastThem && (lastThem.intent || lastThem.idea)) || ch.mnemonic,
            plan: ch.mnemonic || p.move.idea,
            situation: (lastThem ? (lastThem.intent || lastThem.san) : ch.name)
          });
        });
      });
    });
    return bank;
  };

  window.Openings = Openings;
})();
