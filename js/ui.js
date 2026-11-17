/* Openings library, Find-your-openings, Fianchetto module, Clarity drills. */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const UI = {
    hooks: {},
    library: null,
    blake: null,
    fianchetto: null,
    rec: null,
    locked: null,
    sub: "home", // home | find | fianchetto | opening | drill | clarity
  };

  function baseURL() {
    return new URL(".", document.baseURI || location.href);
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }


  function ringSVG(known, total) {
    const tot = total || 1;
    const pct = Math.max(0, Math.min(1, (known || 0) / tot));
    const r = 15, c = 2 * Math.PI * r;
    const dash = (pct * c).toFixed(1);
    return "<svg class=\"ring\" viewBox=\"0 0 36 36\" aria-hidden=\"true\"><circle cx=\"18\" cy=\"18\" r=\"15\" fill=\"none\" stroke=\"#2a3c2e\" stroke-width=\"4\"/><circle cx=\"18\" cy=\"18\" r=\"15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\" stroke-dasharray=\"" + dash + " " + c.toFixed(1) + "\" stroke-linecap=\"round\" transform=\"rotate(-90 18 18)\"/></svg>";
  }
  function words8(s) {
    if (window.Practice && window.Practice.words8) return window.Practice.words8(s);
    const w = String(s || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    return w.length <= 8 ? w.join(" ") : w.slice(0, 8).join(" ");
  }
  const AppChrome = window.AppChrome || {
    setTitle: function (tt) { const el = document.getElementById("app-title"); if (el) el.textContent = tt || ""; },
    setBack: function (fn) {
      const b = document.getElementById("btn-back");
      if (!b) return;
      b.hidden = !fn;
      b.onclick = fn || null;
    }
  };
  window.AppChrome = AppChrome;

  function playOutFrom(fen, color, note) {
    if (window.UI && window.UI.showTab) window.UI.showTab("play");
    if (UI.hooks && UI.hooks.playFromFen) {
      const opp = (UI.hooks.currentOpponent && UI.hooks.currentOpponent()) || (document.getElementById("opp-select") && document.getElementById("opp-select").value) || null;
      UI.hooks.playFromFen({ fen: fen, color: color === "b" || color === "black" ? "black" : "white", opponentId: opp, note: note || "" });
    }
  }

  function chapterEndHTML(opening, ch) {
    const chs = (opening && opening.chapters) || [];
    const idx = chs.findIndex((c) => c.id === ch.id);
    const next = idx >= 0 && idx + 1 < chs.length ? chs[idx + 1] : null;
    const p = window.Openings.chapterProgress(opening, ch);
    const op = window.Openings.openingProgress(opening);
    return "<p class=\"muted\">This chapter: " + p.known + " of " + p.total + " of your moves learned. Opening: " + op.known + " of " + op.total + ".</p>" +
      "<div class=\"nav-row\" id=\"ch-end-nav\">" +
      (next ? "<button type=\"button\" class=\"primary\" id=\"end-next\">Next chapter: " + esc(next.name) + "</button>" : "") +
      "<button type=\"button\" id=\"end-quiz\">Quiz this chapter</button>" +
      "<button type=\"button\" id=\"end-back\">Back to opening</button>" +
      "<button type=\"button\" id=\"end-tree\">Tree map</button>" +
      "<button type=\"button\" id=\"end-again\">Again</button>" +
      "</div>";
  }

  function bindChapterEnd(root, opening, ch, kind) {
    const chs = (opening && opening.chapters) || [];
    const idx = chs.findIndex((c) => c.id === ch.id);
    const next = idx >= 0 && idx + 1 < chs.length ? chs[idx + 1] : null;
    const n = $("#end-next", root);
    if (n && next) n.addEventListener("click", () => startLearn(opening, next));
    const q = $("#end-quiz", root);
    if (q) q.addEventListener("click", () => startQuiz(opening, ch));
    const b = $("#end-back", root);
    if (b) b.addEventListener("click", () => openOpening(opening.id));
    const t = $("#end-tree", root);
    if (t) t.addEventListener("click", () => showTreeMap(opening, ch));
    const a = $("#end-again", root);
    if (a) a.addEventListener("click", () => (kind === "quiz" ? startQuiz(opening, ch) : startLearn(opening, ch)));
  }

  function showTreeMap(opening, ch) {
    const root = $("#openings-root");
    function walk(node, path, depth) {
      return ((node && node.replies) || []).map((r) => {
        const pth = path.concat([r]);
        const uciPath = pth.map((x) => x.uci).join(" ");
        const rec = r.side === "us" ? window.Openings.srsRecord(window.Openings.branchKey(opening.id, ch.id, uciPath)) : null;
        const cls = (r.side === "us" ? "us" : "them") + (rec && rec.known ? " known" : "");
        const mark = r.side === "us" ? (rec && rec.known ? " ✓" : " ·") : "";
        const idea = r.idea ? " <span class=\"muted\">" + esc((window.Practice && window.Practice.short ? window.Practice.short(r.idea, 64) : r.idea)) + "</span>" : "";
        return "<div class=\"tree-node\" style=\"padding-left:" + (depth ? 12 : 0) + "px\"><div><span class=\"" + cls + "\">" + esc(r.san) + mark + "</span>" + idea + "</div>" + walk(r, pth, depth + 1) + "</div>";
      }).join("");
    }
    const p = window.Openings.chapterProgress(opening, ch);
    root.innerHTML =
      "<div class=\"op-page\"><button type=\"button\" class=\"text-btn\" id=\"back-op\">← " + esc(opening.name) + "</button>" +
      "<h2>" + esc(ch.name) + " — tree map</h2>" +
      "<p class=\"muted\">" + p.known + " of " + p.total + " of your moves learned. Your moves are marked ✓ when they stick.</p>" +
      "<div class=\"tree-map\">" + walk(ch.tree || { replies: [] }, [], 0) + "</div>" +
      chapterEndHTML(opening, ch) + "</div>";
    $("#back-op", root).addEventListener("click", () => openOpening(opening.id));
    bindChapterEnd(root, opening, ch, "learn");
  }

  function showAnswerOn(chess, board, sans) {
    const want = (sans || [])[0];
    if (!want) return null;
    const mv = chess.move(want, { sloppy: true });
    if (!mv) return null;
    board.setPosition(chess.fen(), { from: mv.from, to: mv.to, promotion: mv.promotion, san: mv.san });
    if (board.setArrows) board.setArrows([{ from: mv.from, to: mv.to, color: "#3d8b6e" }]);
    return mv;
  }


  function loadLocked() {
    try { return JSON.parse(localStorage.getItem("sc.repertoire.lock.v1") || "null"); } catch (e) { return null; }
  }
  function saveLocked(obj) {
    UI.locked = obj;
    try { localStorage.setItem("sc.repertoire.lock.v1", JSON.stringify(obj)); } catch (e) {}
  }

  async function loadData() {
    if (UI._dataLoaded) return;
    if (UI._dataPromise) return UI._dataPromise;
    const base = baseURL();
    UI._dataPromise = loadDataNow(base);
    await UI._dataPromise;
    UI._dataLoaded = true;
  }
  async function loadDataNow(base) {
    const [rec, blake, lib, def, pircPlans, clarity] = await Promise.all([
      window.Openings.load().catch(() => ({ openings: [] })),
      fetch(new URL("data/blake-openings.json", base)).then((r) => r.json()).catch(() => null),
      fetch(new URL("data/openings/index.json", base)).then((r) => r.json()).catch(() => null),
      fetch(new URL("data/default-repertoire.json", base)).then((r) => r.json()).catch(() => null),
      fetch(new URL("data/plans/pirc-modern.json", base)).then((r) => r.json()).catch(() => null),
      fetch(new URL("data/clarity.json", base)).then((r) => r.json()).catch(() => null),
    ]);
    UI.rec = rec;
    UI.blake = blake;
    UI.library = lib;
    UI.pircPlans = pircPlans;
    UI.clarity = clarity;
    if (window.Fianchetto) UI.fianchetto = await window.Fianchetto.load().catch(() => null);
    const preset = def || (rec && rec.defaultRepertoire);
    if (!loadLocked() && preset) saveLocked(preset);
    else UI.locked = loadLocked() || preset;
  }

  function showTab(name) {
    if (name === "learn") name = "openings";
    if (name === "drills") name = "clarity";
    $$(".tab").forEach((t) => t.classList.toggle("on", t.getAttribute("data-tab") === name));
    ["play", "openings", "clarity"].forEach((id) => {
      const el = document.getElementById(id + "-view");
      if (el) el.hidden = id !== name;
    });
    if (name === "play") {
      AppChrome.setTitle("Play");
      AppChrome.setBack(null);
    }
    if (name === "openings") {
      AppChrome.setTitle("Learn");
      if (!UI._dataLoaded && UI.loadData) UI.loadData().then(() => renderOpenings());
      else renderOpenings();
    }
    if (name === "clarity") {
      AppChrome.setTitle("Drills");
      AppChrome.setBack(null);
      if (!UI._dataLoaded && UI.loadData) UI.loadData().then(() => renderClarity());
      else renderClarity();
    }
  }

  function renderOpenings() {
    const root = $("#openings-root");
    if (!root) return;
    if (UI.sub === "fianchetto") return renderFianchetto(root);
    if (UI.sub === "drill") return; // drill renderer owns the root
    if (UI.sub === "find") return renderFind(root);
    if (UI.sub === "pirc-plans") return renderPircPlans(root);
    if (UI.sub === "opening") return; // owned by opening renderer
    if (UI.sub === "learn" || UI.sub === "quiz" || UI.sub === "which" || UI.sub === "compare") return;
    UI.sub = "home";
    AppChrome.setTitle("Learn");
    AppChrome.setBack(null);
    const openings = (window.Openings && window.Openings.openings()) || [];
    const deepIds = ["ponziani","alapin","white-c3d4","vienna","scotch","open-games","pirc","rousseau","caro"];
    const recSet = {};
    deepIds.forEach((id) => { recSet[id] = true; });
    function card(o) {
      const pr = window.Openings.openingProgress(o);
      const rec = recSet[o.id] ? " rec" : "";
      return "<button type=\"button\" class=\"opening-card" + rec + "\" data-open=\"" + esc(o.id) + "\">" +
        ringSVG(pr.known, pr.total) +
        "<span><strong>" + esc(o.name) + "</strong><span> " + (o.color === "white" ? "White" : "Black") +
        " · " + (pr.known || 0) + "/" + (pr.total || 0) + "</span></span></button>";
    }
    const rec = openings.filter((o) => recSet[o.id]);
    const rest = openings.filter((o) => !recSet[o.id]);
    root.innerHTML =
      "<div class=\"op-home\">" +
      "<div class=\"opening-list\">" + rec.map(card).join("") + "</div>" +
      (rest.length ? "<button type=\"button\" class=\"sub-link\" id=\"btn-more-ops\">More openings</button><div id=\"more-ops\" hidden class=\"opening-list\"></div>" : "") +
      "<button type=\"button\" class=\"sub-link\" id=\"btn-find\">Find your openings</button>" +
      "</div>";
    const more = $("#btn-more-ops", root);
    if (more) more.addEventListener("click", () => {
      const box = $("#more-ops", root);
      box.hidden = !box.hidden;
      if (!box.dataset.filled) {
        box.innerHTML = rest.map(card).join("");
        box.dataset.filled = "1";
        $$("[data-open]", box).forEach((btn) => btn.addEventListener("click", () => openOpening(btn.getAttribute("data-open"))));
      }
    });
    const bfind = $("#btn-find", root);
    if (bfind) bfind.addEventListener("click", () => { UI.sub = "find"; renderOpenings(); });
    $$("[data-open]", root).forEach((btn) => btn.addEventListener("click", () => openOpening(btn.getAttribute("data-open"))));
  }

  function backHome() { UI.sub = "home"; renderOpenings(); }

  function renderFianchetto(root) {
    const F = UI.fianchetto;
    if (!F) { root.innerHTML = "<p>Couldn't load the Fianchetto module.</p>"; return; }
    const st = F.stats || {};
    const p1 = (F.parts || []).find((p) => p.id === "attack-theirs") || {};
    const p2 = (F.parts || []).find((p) => p.id === "own-fianchetto") || {};
    if (window.AppChrome) {
      AppChrome.setTitle("Fianchetto");
      AppChrome.setBack(() => backHome());
    }
    const whyHtml =
      (F.why ? "<p>" + esc(F.why) + "</p>" : "") +
      (p1.intro ? "<p>" + esc(p1.intro) + "</p>" : "") +
      (p1.vsAnthony ? "<p>" + esc(p1.vsAnthony) + "</p>" : "") +
      (p1.hFileIntro ? "<p>" + esc(p1.hFileIntro) + "</p>" : "") +
      (F.hFileChecklist && F.hFileChecklist.length ? "<ol class=\"h-checklist\">" + F.hFileChecklist.map(function (it) {
        return "<li><strong>" + esc(it.name) + ".</strong> " + esc(it.rule) + "</li>";
      }).join("") + "</ol>" : "") +
      (p2.intro ? "<p>" + esc(p2.intro) + "</p>" : "");
    root.innerHTML =
      "<div class=\"op-page\">" +
      "<p class=\"cue-bar\">Trade the bishop, then open a file. <button type=\"button\" class=\"text-btn why-btn\" id=\"f-why-btn\">Why?</button></p>" +
      "<div id=\"f-why-panel\" class=\"why-panel\" hidden>" + whyHtml + "</div>" +
      "<div class=\"opening-list\" id=\"model-list\"></div>" +
      "<div class=\"opening-list\" id=\"drill-list\"></div>" +
      "</div>";
    const whyBtn = $("#f-why-btn", root);
    if (whyBtn) whyBtn.addEventListener("click", () => {
      const box = $("#f-why-panel", root);
      if (box) box.hidden = !box.hidden;
    });
    const ml = $("#model-list", root);
    (F.modelGames || []).forEach((g, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "drill-card";
      const label = g.title || g.event || ("Model " + (i + 1));
      b.innerHTML = "<strong>" + esc(label) + "</strong>";
      b.addEventListener("click", () => openModelGame(g));
      ml.appendChild(b);
    });
    const dl = $("#drill-list", root);
    (F.drills || []).forEach((d, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "drill-card";
      b.innerHTML = "<strong>Drill " + (i + 1) + "</strong>";
      b.addEventListener("click", () => openDrill(d));
      dl.appendChild(b);
    });
  }


  function openModelGame(g) {
    const root = $("#openings-root");
    let ply = 0;
    const chess = new Chess();
    function fenAt(n) {
      const c = new Chess();
      for (let i = 0; i < n && i < (g.sans || []).length; i++) c.move(g.sans[i], { sloppy: true });
      return c.fen();
    }
    function noteAt(n) {
      const notes = g.notes || [];
      const hit = notes.filter((x) => x.after === n || x.ply === n);
      return hit.map((x) => x.text).join(" ");
    }
    root.innerHTML =
      "<div class=\"op-page\">" +
      "<button type=\"button\" class=\"text-btn\" id=\"back-f\">← Fianchetto module</button>" +
      "<h2>" + esc(g.white) + " – " + esc(g.black) + "</h2>" +
      "<p class=\"muted\">" + esc(g.event) + (g.date ? ", " + esc(g.date) : "") + " · " + esc(g.result) +
      (g.url ? " · <a href=\"" + esc(g.url) + "\" target=\"_blank\" rel=\"noopener\">source</a>" : "") + "</p>" +
      "<p>" + esc(g.summary) + "</p>" +
      "<div id=\"review-board\" class=\"mini-board\"></div>" +
      "<div class=\"play-bar nav-row\">" +
      "<button type=\"button\" id=\"gm-prev\">Prev</button>" +
      "<span id=\"gm-ply\"></span>" +
      "<button type=\"button\" id=\"gm-next\">Next</button>" +
      "</div>" +
      "<p id=\"gm-san\" class=\"muted\"></p>" +
      "<p id=\"gm-note\"></p>" +
      "<p class=\"credit muted\">" + esc(g.source) + "</p>" +
      "</div>";
    $("#back-f", root).addEventListener("click", () => { UI.sub = "fianchetto"; renderOpenings(); });
    reviewBoard = new window.BoardUI($("#review-board"), { flipped: false, canMove: () => false, onMove: function () {} });
    function paint() {
      reviewBoard.setPosition(fenAt(ply), ply ? null : null);
      const san = (g.sans || []).slice(0, ply);
      $("#gm-ply").textContent = "Move " + Math.ceil(ply / 2) + " (" + ply + " plies)";
      $("#gm-san").textContent = san.join(" ");
      $("#gm-note").textContent = noteAt(ply) || "";
    }
    $("#gm-prev").addEventListener("click", () => { ply = Math.max(0, ply - 1); paint(); });
    $("#gm-next").addEventListener("click", () => { ply = Math.min((g.sans || []).length, ply + 1); paint(); });
    paint();
  }

  function openDrill(d) {
    UI.sub = "drill";
    const root = $("#openings-root");
    let chess;
    try { chess = new Chess(d.fen); } catch (e) { chess = new Chess(); }
    let pickedPlan = null;
    let moved = null;
    const cue = (window.Practice && window.Practice.short ? window.Practice.short(d.prompt, 110) : d.prompt) || "Play the plan.";
    root.innerHTML =
      "<div class=\"op-page drill-page\">" +
      "<button type=\"button\" class=\"text-btn\" id=\"back-f\">← Fianchetto module</button>" +
      "<h2>Drill</h2>" +
      "<p class=\"cue-bar\">" + esc(cue) + " <button type=\"button\" class=\"text-btn why-btn\" id=\"d-why\">Why?</button></p>" +
      "<div id=\"d-why-panel\" class=\"why-panel\" hidden></div>" +
      "<div id=\"drill-board\" class=\"mini-board\"></div>" +
      "<div id=\"plan-choices\" class=\"idea-choices\" hidden></div>" +
      "<div id=\"drill-fb\" class=\"drill-fb\" hidden></div>" +
      "<div class=\"nav-row\"><button type=\"button\" id=\"drill-show\">Show answer</button>" +
      "<button type=\"button\" id=\"drill-again\" hidden>Again</button>" +
      "<button type=\"button\" id=\"drill-play\" hidden>Play it out</button>" +
      "<button type=\"button\" id=\"drill-back\" hidden>Back to list</button></div>" +
      "</div>";
    $("#back-f", root).addEventListener("click", () => { UI.sub = "fianchetto"; renderOpenings(); });
    const whyBox = $("#d-why-panel", root);
    const plans = d.planChoices || [];
    whyBox.innerHTML = (d.fromGame ? "<p>From one of your games" + (d.fromGame.url ? ": <a href=\"" + esc(d.fromGame.url) + "\" target=\"_blank\" rel=\"noopener\">open it</a>" : "") + ".</p>" : "") +
      (plans.length ? "<p>What’s the plan?</p>" : "") + (d.prompt && d.prompt !== cue ? "<p>" + esc(d.prompt) + "</p>" : "");
    const pc = $("#plan-choices", root);
    plans.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "choice"; b.textContent = c.text;
      b.addEventListener("click", () => {
        if (moved) return;
        pickedPlan = c;
        $$(".choice", pc).forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
      });
      pc.appendChild(b);
    });
    $("#d-why", root).addEventListener("click", () => {
      whyBox.hidden = !whyBox.hidden;
      if (plans.length) pc.hidden = whyBox.hidden;
    });
    const board = new window.BoardUI($("#drill-board"), {
      flipped: d.side === "black",
      showMaterial: true,
      canMove: () => !moved && chess.turn() === (d.side === "black" ? "b" : "w"),
      onMove: (spec) => {
        const preview = new Chess(chess.fen());
        const mv = preview.move({ from: spec.from, to: spec.to, promotion: spec.promotion || "q" });
        if (!mv) return;
        chess.move(mv);
        board.setPosition(chess.fen(), { from: mv.from, to: mv.to });
        moved = mv.san;
        finish();
      }
    });
    board.setPosition(d.fen, d.lastMove || null);
    if (d.lastMove && d.lastMove.to) board.setHighlights([{ square: d.lastMove.to, kind: "last" }]);

    function navDone() {
      $("#drill-again", root).hidden = false;
      $("#drill-play", root).hidden = false;
      $("#drill-back", root).hidden = false;
      $("#drill-show", root).hidden = true;
    }
    function finish() {
      const okMove = (d.acceptedMoves || d.preferredMoves || []).indexOf(moved) !== -1;
      const fb = $("#drill-fb", root);
      fb.hidden = false;
      let html = "";
      if (okMove) html += "<p class=\"ok\">" + esc(d.feedbackGood || "That’s the idea.") + "</p>";
      else html += "<p class=\"bad\">" + esc(d.feedbackBad || "Not that one.") + (moved ? " You played " + esc(moved) + "." : "") + (d.engineBest ? " Engine likes " + esc(d.engineBest) + "." : "") + "</p>";
      if (pickedPlan && !pickedPlan.correct && pickedPlan.why) html += "<p>" + esc(pickedPlan.why) + "</p>";
      fb.innerHTML = html;
      navDone();
    }
    $("#drill-show", root).addEventListener("click", () => {
      if (moved) return;
      const mv = showAnswerOn(chess, board, d.preferredMoves || d.acceptedMoves || (d.engineBest ? [d.engineBest] : []));
      moved = mv ? mv.san : "shown";
      const fb = $("#drill-fb", root);
      fb.hidden = false;
      fb.innerHTML = "<p>" + esc((d.preferredMoves || d.acceptedMoves || []).join(" or ") || d.engineBest || "") + ". " + esc(d.feedbackGood || "") + "</p>";
      navDone();
    });
    $("#drill-again", root).addEventListener("click", () => openDrill(d));
    $("#drill-play", root).addEventListener("click", () => playOutFrom(d.fen, d.side, d.prompt));
    $("#drill-back", root).addEventListener("click", () => { UI.sub = "fianchetto"; renderOpenings(); });
  }


  function renderFind(root) {
    const F = window.FindOpenings;
    if (!F) { root.innerHTML = "<p>Couldn't load the opening quiz.</p>"; return; }
    const answers = UI.findAnswers || {};
    const qIndex = typeof UI.findQ === "number" ? UI.findQ : 0;
    const questions = F.QUESTIONS;
    root.innerHTML =
      "<div class=\"op-page\">" +
      "<button type=\"button\" class=\"text-btn\" id=\"back-home\">← Openings</button>" +
      "<h2>Find your openings</h2>" +
      "<p>Five questions about how you like to play, then a score that also uses your Chess.com results (4,093 games). Your current repertoire is the starting point; you can lock a different mix if the scores say so.</p>" +
      "<div id=\"find-body\"></div></div>";
    $("#back-home", root).addEventListener("click", backHome);
    const body = $("#find-body", root);

    function showQuestion(i) {
      UI.findQ = i;
      if (i >= questions.length) return showResults();
      const q = questions[i];
      body.innerHTML =
        "<p class=\"muted\">Question " + (i + 1) + " of " + questions.length + "</p>" +
        "<h3>" + esc(q.text) + "</h3>" +
        "<div class=\"choices\">" + q.choices.map((c) =>
          "<button type=\"button\" class=\"choice" + (answers[q.id] === c.id ? " on" : "") + "\" data-c=\"" + esc(c.id) + "\">" + esc(c.label) + "</button>"
        ).join("") + "</div>";
      $$("[data-c]", body).forEach((btn) => btn.addEventListener("click", () => {
        answers[q.id] = btn.getAttribute("data-c");
        UI.findAnswers = answers;
        showQuestion(i + 1);
      }));
    }

    function card(r) {
      const st = F.formatStat(r.stat);
      return "<article class=\"score-card\">" +
        "<h4>" + esc(r.name) + " <em class=\"score\">" + r.score + "</em></h4>" +
        "<p class=\"muted\">" + esc(r.moves) + " · vs " + esc(r.vs) + "</p>" +
        "<p><strong>Your results:</strong> " + esc(st) + "</p>" +
        "<p><strong>Why it fits:</strong> " + esc(r.pros) + "</p>" +
        "<p><strong>The catch:</strong> " + esc(r.cons) + "</p>" +
        "<div class=\"nav-row\">" +
        "<button type=\"button\" class=\"try-btn\" data-open=\"" + esc(r.id) + "\">Study the line</button>" +
        (UI.hooks && UI.hooks.startSparring ? "<button type=\"button\" data-drive=\"" + esc(r.id) + "\">Test-drive vs a bot</button>" : "") +
        "</div></article>";
    }

    function showResults() {
      const result = F.score(answers, UI.blake);
      UI.findResult = result;
      const note = F.unusualNote(answers);
      const w = result.white.slice(0, 3);
      const b = result.black.slice(0, 3);
      body.innerHTML =
        "<h3>Your top fits</h3>" +
        "<p>The number is a 0–100 fit score: the quiz, plus how you’ve actually scored in that family on Chess.com.</p>" +
        (note ? "<p class=\"why-not-mix\">" + esc(note) + "</p>" : "") +
        "<h4>White</h4>" + w.map(card).join("") +
        "<h4>Black</h4>" + b.map(card).join("") +
        "<section class=\"panel\"><h3>Lock a repertoire</h3>" +
        "<p class=\"muted\">This becomes the starting point in the library. You can change it later. Ponziani first, Vienna second, Scotch third is what you already picked; the quiz is here if you want to confirm or swap.</p>" +
        "<button type=\"button\" class=\"primary\" id=\"lock-current\">Keep my current repertoire</button> " +
        "<button type=\"button\" id=\"lock-top\">Lock the quiz’s top mix</button> " +
        "<button type=\"button\" class=\"text-btn\" id=\"retake\">Retake the quiz</button>" +
        "<p id=\"lock-msg\" class=\"muted\"></p></section>";
      $$("[data-open]", body).forEach((btn) => btn.addEventListener("click", () => openOpening(btn.getAttribute("data-open"))));
      $$("[data-drive]", body).forEach((btn) => btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-drive");
        if (UI.hooks && UI.hooks.startSparring) {
          const o = window.Openings && window.Openings.opening(id);
          const as = o && o.color === "black" ? "black" : "white";
          UI.hooks.startSparring({ playAs: as, opponentId: (UI.hooks.currentOpponent && UI.hooks.currentOpponent()) || undefined });
          if (window.UI && window.UI.showTab) window.UI.showTab("play");
        }
      }));
      const msg = $("#lock-msg", body);
      $("#lock-current", body).addEventListener("click", () => {
        msg.textContent = "Kept your current repertoire: Ponziani, Vienna, Scotch as White; Pirc, Rousseau, Caro-Kann as Black.";
      });
      $("#lock-top", body).addEventListener("click", () => {
        const locked = loadLocked() || {};
        locked.quizTop = { white: w.map((x) => x.id), black: b.map((x) => x.id), at: Date.now() };
        saveLocked(locked);
        msg.textContent = "Locked the quiz’s top mix: White " + w.map((x) => x.name).join(", ") + "; Black " + b.map((x) => x.name).join(", ") + ".";
      });
      $("#retake", body).addEventListener("click", () => {
        UI.findAnswers = {};
        UI.findQ = 0;
        renderFind(root);
      });
    }

    if (Object.keys(answers).length >= questions.length) showResults();
    else showQuestion(qIndex);
  }

  function renderPircPlans(root) {
    const P = UI.pircPlans;
    if (!P) { root.innerHTML = "<p>Couldn't load the Pirc and Modern plans.</p>"; return; }
    root.innerHTML =
      "<div class=\"op-page\">" +
      "<button type=\"button\" class=\"text-btn\" id=\"back-home\">← Openings</button>" +
      "<h2>" + esc(P.title) + "</h2><p>" + esc(P.intro) + "</p>" +
      (P.systems || []).map((s) =>
        "<section class=\"panel principle\"><h3>" + esc(s.name) + "</h3>" +
        "<p><strong>What he does:</strong> " + esc(s.whiteDoes) + "</p>" +
        "<p><strong>Your plan:</strong> " + esc(s.plan) + "</p>" +
        "<p class=\"rule\">" + esc(s.rule) + "</p>" +
        "<ul>" + (s.breaks || []).map((b) => "<li>" + esc(b) + "</li>").join("") + "</ul>" +
        (s.note ? "<p class=\"muted\">" + esc(s.note) + "</p>" : "") +
        "</section>"
      ).join("") +
      "<section class=\"panel\"><h3>Find the break</h3><p class=\"muted\">Each drill asks for the plan, then the first move, on a real Pirc setup.</p>" +
      "<div class=\"card-grid\" id=\"pirc-drills\"></div></section>" +
      "<p class=\"credit muted\">" + esc(P.credit) + "</p></div>";
    $("#back-home", root).addEventListener("click", backHome);
    const box = $("#pirc-drills", root);
    (P.drills || []).forEach((d, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "card-link";
      b.innerHTML = "<strong>Drill " + (i + 1) + " · " + esc(d.system) + "</strong><span>" + esc(d.prompt).slice(0, 90) + "…</span>";
      b.addEventListener("click", () => openPlanDrill(d));
      box.appendChild(b);
    });
  }

  function openPlanDrill(d) {
    UI.sub = "drill";
    const root = $("#openings-root");
    let chess;
    try { chess = new Chess(d.fen); } catch (e) { chess = new Chess(); }
    let picked = null;
    let moved = null;
    const cue = (window.Practice && window.Practice.short ? window.Practice.short(d.prompt, 110) : d.prompt) || "Which pawn break now?";
    root.innerHTML =
      "<div class=\"op-page drill-page\">" +
      "<button type=\"button\" class=\"text-btn\" id=\"back-p\">← Attacking plans</button>" +
      "<h2>Find the break</h2>" +
      "<p class=\"cue-bar\">" + esc(cue) + " <button type=\"button\" class=\"text-btn why-btn\" id=\"d-why\">Why?</button></p>" +
      "<div id=\"d-why-panel\" class=\"why-panel\" hidden></div>" +
      "<div id=\"drill-board\" class=\"mini-board\"></div>" +
      "<div id=\"plan-choices\" class=\"idea-choices\" hidden></div>" +
      "<div id=\"drill-fb\" class=\"drill-fb\" hidden></div>" +
      "<div class=\"nav-row\"><button type=\"button\" id=\"drill-show\">Show answer</button>" +
      "<button type=\"button\" id=\"drill-again\" hidden>Again</button>" +
      "<button type=\"button\" id=\"drill-play\" hidden>Play it out</button>" +
      "<button type=\"button\" id=\"drill-back\" hidden>Back to list</button></div>" +
      "</div>";
    $("#back-p", root).addEventListener("click", () => { UI.sub = "pirc-plans"; renderOpenings(); });
    const whyBox = $("#d-why-panel", root);
    whyBox.innerHTML = "<p>What’s the plan against this White setup?</p>";
    const pc = $("#plan-choices", root);
    (d.plans || []).forEach((pl) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "choice";
      b.textContent = pl.label;
      b.addEventListener("click", () => {
        if (moved) return;
        picked = pl.id;
        $$(".choice", pc).forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
      });
      pc.appendChild(b);
    });
    $("#d-why", root).addEventListener("click", () => {
      whyBox.hidden = !whyBox.hidden;
      pc.hidden = whyBox.hidden;
    });
    function navDone() {
      $("#drill-again", root).hidden = false;
      $("#drill-play", root).hidden = false;
      $("#drill-back", root).hidden = false;
      $("#drill-show", root).hidden = true;
    }
    const board = new window.BoardUI($("#drill-board"), {
      flipped: d.side === "black",
      showMaterial: true,
      canMove: () => !moved && chess.turn() === (d.side === "black" ? "b" : "w"),
      onMove: (spec) => {
        const preview = new Chess(chess.fen());
        const mv = preview.move({ from: spec.from, to: spec.to, promotion: spec.promotion || "q" });
        if (!mv) return;
        chess.move(mv);
        moved = mv;
        board.setPosition(chess.fen(), mv);
        const good = (d.goodMoves || []).indexOf(mv.san) >= 0;
        const planOk = !d.correctPlans || !picked || d.correctPlans.indexOf(picked) >= 0;
        const fb = $("#drill-fb");
        fb.hidden = false;
        fb.className = "drill-fb " + (good && planOk ? "ok" : "bad");
        fb.innerHTML = (good && planOk ? esc(d.feedbackGood) : esc(d.feedbackBad)) +
          (good ? "" : "<p>A good first move was " + esc((d.goodMoves || []).join(" or ")) + ".</p>");
        navDone();
      }
    });
    board.setPosition(d.fen, d.lastMove || null);
    $("#drill-show", root).addEventListener("click", () => {
      if (moved) return;
      const mv = showAnswerOn(chess, board, d.goodMoves || []);
      moved = mv || { san: "shown" };
      const fb = $("#drill-fb");
      fb.hidden = false;
      fb.innerHTML = "<p>A good first move was " + esc((d.goodMoves || []).join(" or ")) + ". " + esc(d.feedbackGood || "") + "</p>";
      navDone();
    });
    $("#drill-again", root).addEventListener("click", () => openPlanDrill(d));
    $("#drill-play", root).addEventListener("click", () => playOutFrom(d.fen, d.side, d.prompt));
    $("#drill-back", root).addEventListener("click", () => { UI.sub = "pirc-plans"; renderOpenings(); });
  }

  function openOpening(id) {
    const o = window.Openings.opening(id);
    const root = $("#openings-root");
    if (!o) { root.innerHTML = "<p>Opening not found.</p>"; return; }
    UI.sub = "opening";
    AppChrome.setTitle(o.name);
    AppChrome.setBack(() => backHome());
    const prog = window.Openings.openingProgress(o);
    const chs = (o.chapters || []).map((ch) => {
      const p = window.Openings.chapterProgress(o, ch);
      const learned = p.total && p.known >= p.total;
      const rec = learned ? "solo" : "guided";
      return "<div class=\"chapter-card-wrap\">" +
        "<div class=\"chapter-head\">" + ringSVG(p.known, p.total) +
        "<div><strong>" + esc(ch.name) + "</strong><span class=\"muted\"> " + p.known + "/" + p.total + "</span></div></div>" +
        "<div class=\"mode-row\">" +
        "<button type=\"button\" class=\"mode-btn" + (rec === "guided" ? " rec" : "") + "\" data-ch=\"" + esc(ch.id) + "\" data-mode=\"guided\">Guided</button>" +
        "<button type=\"button\" class=\"mode-btn" + (rec === "solo" ? " rec" : "") + "\" data-ch=\"" + esc(ch.id) + "\" data-mode=\"solo\">Solo</button>" +
        "</div>" +
        "<p class=\"rec-hint\">" + (learned ? "Ready for Solo" : "Start with Guided") + "</p>" +
        "<button type=\"button\" class=\"sub-link\" data-ch=\"" + esc(ch.id) + "\" data-mode=\"study\">Map</button> " +
        "<button type=\"button\" class=\"sub-link\" data-ch=\"" + esc(ch.id) + "\" data-mode=\"quiz\">Quiz</button>" +
        "</div>";
    }).join("");
    root.innerHTML =
      "<div class=\"op-page\">" +
      "<p class=\"muted\">" + prog.known + "/" + prog.total + "</p>" +
      "<div class=\"nav-row\">" +
      "<button type=\"button\" class=\"sub-link\" id=\"btn-which\">Which line?</button>" +
      "<button type=\"button\" class=\"sub-link\" id=\"btn-compare\">Compare</button>" +
      (o.id === "pirc" ? "<button type=\"button\" class=\"sub-link\" id=\"btn-to-plans\">Plans</button>" : "") +
      "</div>" + chs + "</div>";
    const which = $("#btn-which", root);
    if (which) which.addEventListener("click", () => startWhichLine(o));
    const cmp = $("#btn-compare", root);
    if (cmp) cmp.addEventListener("click", () => startCompare(o));
    const tp = $("#btn-to-plans", root);
    if (tp) tp.addEventListener("click", () => { UI.sub = "pirc-plans"; renderOpenings(); });
    $$("[data-ch]", root).forEach((btn) => {
      const ch = window.Openings.chapter(o.id, btn.getAttribute("data-ch"));
      const mode = btn.getAttribute("data-mode");
      btn.addEventListener("click", () => {
        if (mode === "guided" || mode === "solo") startLearn(o, ch, mode);
        else if (mode === "quiz") startQuiz(o, ch);
        else studyChapter(o, ch);
      });
    });
  }

  function studyChapter(opening, ch) {
    if (!ch) return;
    const root = $("#openings-root");
    const sit = window.Openings.situationAt(opening, ch, []);
    root.innerHTML =
      "<div class=\"op-page\"><button type=\"button\" class=\"text-btn\" id=\"back-op\">← " + esc(opening.name) + "</button>" +
      "<h2>" + esc(ch.name) + "</h2><p class=\"rule\">" + esc(ch.mnemonic) + "</p>" +
      "<div class=\"nav-row\">" +
      "<button type=\"button\" class=\"primary\" id=\"st-learn\">Learn this chapter</button>" +
      "<button type=\"button\" id=\"st-quiz\">Quiz</button>" +
      "<button type=\"button\" id=\"st-which\">Which line am I in?</button>" +
      "</div>" +
      "<div id=\"study-board\" class=\"mini-board\"></div>" +
      "<div class=\"play-bar nav-row\"><button type=\"button\" id=\"st-prev\">Prev</button><span id=\"st-san\"></span><button type=\"button\" id=\"st-next\">Next</button></div>" +
      "<div id=\"sit-map\"></div></div>";
    $("#back-op").addEventListener("click", () => openOpening(opening.id));
    $("#st-learn").addEventListener("click", () => startLearn(opening, ch));
    $("#st-quiz").addEventListener("click", () => startQuiz(opening, ch));
    $("#st-which").addEventListener("click", () => startWhichLine(opening));
    const board = new window.BoardUI($("#study-board"), { flipped: opening.color === "black", canMove: () => false, onMove: function () {} });
    const line = [];
    function walk(node) {
      const reps = (node && node.replies) || [];
      const main = reps.find((r) => r.main) || reps[0];
      if (!main) return;
      line.push(main);
      walk(main);
    }
    walk(ch.tree || { replies: [] });
    let ply = 0;
    function fenAt(n) {
      const c = new Chess();
      for (let i = 0; i < n && i < line.length; i++) {
        const u = line[i].uci;
        c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      }
      return c.fen();
    }
    function paint() {
      board.setPosition(fenAt(ply), null);
      const cur = line[ply - 1];
      $("#st-san").textContent = line.slice(0, ply).map((n) => n.san).join(" ");
      const path = line.slice(0, ply);
      const sm = window.Openings.situationAt(opening, ch, path);
      const box = $("#sit-map");
      if (!sm || !sm.items || !sm.items.length) { box.innerHTML = cur ? "<p>" + esc(cur.idea || cur.plan || "") + "</p>" : "<p>Start of the chapter. Press Next to walk the main line. The labels under the board name what he’s trying at each split.</p>"; return; }
      box.innerHTML = "<h3>What’s he trying, and what’s your answer?</h3><ul class=\"sit\">" +
        sm.items.map((it) => "<li><strong>" + esc(it.move.san) + "</strong> — " + esc(it.intent) +
          (it.answer ? ". You play <strong>" + esc(it.answer.san) + "</strong>" + (it.reason ? ": " + esc(it.reason) : "") : "") +
          "</li>").join("") + "</ul>" +
        ((sm.transpositions || []).length ? "<p class=\"muted\">These move orders end up in the same plan: " + sm.transpositions.map((t) => esc(t)).join("; ") + ".</p>" : "") +
        (cur && cur.idea ? "<p>" + esc(cur.idea) + "</p>" : "");
    }
    $("#st-prev").addEventListener("click", () => { ply = Math.max(0, ply - 1); paint(); });
    $("#st-next").addEventListener("click", () => { ply = Math.min(line.length, ply + 1); paint(); });
    paint();
  }

  function startLearn(opening, ch, mode) {
    UI.sub = "learn";
    const root = $("#openings-root");
    mode = mode === "solo" ? "solo" : "guided";
    if (window.Practice && window.Practice.start) {
      window.Practice.start(root, {
        opening: opening,
        chapter: ch,
        mode: mode,
        onBack: () => openOpening(opening.id),
        onPlayOut: (fen, color, note) => playOutFrom(fen, color, note),
        reviewMove: UI.hooks && UI.hooks.reviewMove,
        onComplete: () => {
          AppChrome.setTitle(ch.name);
          AppChrome.setBack(() => openOpening(opening.id));
          root.innerHTML =
            "<div class=\"op-page\">" +
            "<h2>" + (mode === "solo" ? "Solo complete" : "Chapter complete") + "</h2>" +
            chapterEndHTML(opening, ch) + "</div>";
          bindChapterEnd(root, opening, ch, "learn");
        }
      });
      return;
    }
    const due = window.Openings.dueForChapter(opening, ch);
    if (!due.length) {
      root.innerHTML = "<div class=\"op-page\"><h2>Chapter complete</h2>" + chapterEndHTML(opening, ch) + "</div>";
      AppChrome.setBack(() => openOpening(opening.id));
      bindChapterEnd(root, opening, ch, "learn");
      return;
    }
    runMoveQuiz(root, opening, ch, due, "learn", "Back", () => openOpening(opening.id));
  }

  function startQuiz(opening, ch) {
    UI.sub = "quiz";
    const root = $("#openings-root");
    const order = window.Openings.learnOrder(opening, ch).slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }
    const queue = order.slice(0, Math.min(12, order.length));
    if (!queue.length) {
      root.innerHTML = "<div class=\"op-page\"><p>No quiz positions in this chapter yet.</p><button type=\"button\" class=\"text-btn\" id=\"back-ch\">Back</button></div>";
      $("#back-ch").addEventListener("click", () => studyChapter(opening, ch));
      return;
    }
    runMoveQuiz(root, opening, ch, queue, "quiz", "← " + ch.name, () => studyChapter(opening, ch));
  }

  function runMoveQuiz(root, opening, ch, queue, kind, backLabel, onBack) {
    let i = 0, correct = 0, done = false;
    function show() {
      if (i >= queue.length) {
        root.innerHTML =
          "<div class=\"op-page\"><button type=\"button\" class=\"text-btn\" id=\"back-ch\">" + esc(backLabel) + "</button>" +
          "<h2>" + (kind === "learn" ? "Chapter learned" : "Quiz result") + "</h2>" +
          "<p>You got " + correct + " of " + queue.length + " right. Spaced repetition will bring the misses back first.</p>" +
          chapterEndHTML(opening, ch) + "</div>";
        $("#back-ch").addEventListener("click", onBack);
        bindChapterEnd(root, opening, ch, kind);
        return;
      }
      const pos = queue[i];
      const fen = window.Openings.fenAfter(pos.path.slice(0, -1));
      const want = pos.move;
      done = false;
      root.innerHTML =
        "<div class=\"op-page\"><button type=\"button\" class=\"text-btn\" id=\"back-ch\">" + esc(backLabel) + "</button>" +
        "<h2>" + (kind === "learn" ? "Learn" : "Quiz") + " · " + esc(ch.name) + "</h2>" +
        "<p class=\"cue-bar\">" + (i + 1) + " of " + queue.length + (want.idea ? " — " + esc((window.Practice && window.Practice.short ? window.Practice.short(want.idea, 90) : want.idea)) : " — your move") + "</p>" +
        "<div id=\"learn-board\" class=\"mini-board\"></div>" +
        "<div id=\"learn-fb\" class=\"drill-fb\" hidden></div>" +
        "<div class=\"nav-row\"><button type=\"button\" id=\"learn-show\">Show answer</button>" +
        "<button type=\"button\" id=\"learn-next\" hidden>Next</button></div></div>";
      $("#back-ch").addEventListener("click", onBack);
      const chess = new Chess(fen);
      const board = new window.BoardUI($("#learn-board"), {
        flipped: opening.color === "black",
        canMove: () => !done && chess.turn() === (opening.color === "black" ? "b" : "w"),
        onMove: (spec) => {
          if (done) return;
          const preview = new Chess(fen);
          const mv = preview.move({ from: spec.from, to: spec.to, promotion: spec.promotion || "q" });
          if (!mv) return;
          done = true;
          const ok = mv.uci === want.uci || (mv.from + mv.to + (mv.promotion || "")) === want.uci;
          window.Openings.markBranch(window.Openings.branchKey(opening.id, ch.id, pos.pathUci), ok);
          if (ok) correct++;
          chess.move(mv);
          board.setPosition(chess.fen(), mv);
          const fb = $("#learn-fb");
          fb.hidden = false;
          fb.className = "drill-fb " + (ok ? "ok" : "bad");
          fb.innerHTML = ok
            ? "<p>That’s the move. " + esc(want.idea || "") + "</p>"
            : "<p>Not that one. The move in this line is <strong>" + esc(want.san) + "</strong>. " + esc(want.idea || "") + "</p>";
          const next = $("#learn-next");
          next.hidden = false;
        }
      });
      board.setPosition(fen, null);
      $("#learn-show").addEventListener("click", () => {
        if (done) return;
        done = true;
        const mv = chess.move({ from: want.uci.slice(0, 2), to: want.uci.slice(2, 4), promotion: want.uci[4] });
        if (mv) board.setPosition(chess.fen(), mv);
        if (board.setArrows) board.setArrows([{ from: want.uci.slice(0, 2), to: want.uci.slice(2, 4), color: "#3d8b6e" }]);
        window.Openings.markBranch(window.Openings.branchKey(opening.id, ch.id, pos.pathUci), false);
        const fb = $("#learn-fb");
        fb.hidden = false;
        fb.className = "drill-fb";
        fb.innerHTML = "<p>The move is <strong>" + esc(want.san) + "</strong>. " + esc(want.idea || "") + "</p>";
        const next = $("#learn-next");
        next.hidden = false;
      });
      $("#learn-next").addEventListener("click", () => { i++; show(); });
    }
    show();
  }

  function startWhichLine(opening) {
    UI.sub = "which";
    const root = $("#openings-root");
    let bank = (window.Openings.recognitionBank() || []).filter((p) => p.openingId === opening.id && p.fen);
    if (bank.length < 4) bank = (window.Openings.recognitionBank() || []).filter((p) => p.fen);
    for (let i = bank.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = bank[i]; bank[i] = bank[j]; bank[j] = t;
    }
    const queue = bank.slice(0, Math.min(8, bank.length));
    if (!queue.length) {
      root.innerHTML = "<div class=\"op-page\"><p>Not enough positions yet to quiz this opening.</p><button type=\"button\" class=\"text-btn\" id=\"back-op\">Back</button></div>";
      $("#back-op").addEventListener("click", () => openOpening(opening.id));
      return;
    }
    let i = 0, correct = 0, named = false, moved = false;
    function uniqueChoices(item) {
      const opts = [{ key: item.chapterId, label: item.chapter, plan: item.plan, ok: true }];
      bank.forEach((p) => {
        if (opts.length >= 4) return;
        if (p.chapterId === item.chapterId) return;
        if (opts.some((o) => o.key === p.chapterId)) return;
        opts.push({ key: p.chapterId, label: p.chapter, plan: p.plan, ok: false });
      });
      for (let a = opts.length - 1; a > 0; a--) {
        const b = Math.floor(Math.random() * (a + 1));
        const t = opts[a]; opts[a] = opts[b]; opts[b] = t;
      }
      return opts;
    }
    function show() {
      if (i >= queue.length) {
        const first = (opening.chapters || [])[0];
        root.innerHTML = "<div class=\"op-page\"><button type=\"button\" class=\"text-btn\" id=\"back-op\">← " + esc(opening.name) + "</button>" +
          "<h2>Which line am I in?</h2><p>You named " + correct + " of " + queue.length + " situations correctly.</p>" +
          "<div class=\"nav-row\"><button type=\"button\" class=\"primary\" id=\"again\">Again</button>" +
          "<button type=\"button\" id=\"end-back\">Back to opening</button>" +
          (first ? "<button type=\"button\" id=\"end-learn\">Learn " + esc(first.name) + "</button>" : "") +
          "</div></div>";
        $("#back-op").addEventListener("click", () => openOpening(opening.id));
        $("#again").addEventListener("click", () => startWhichLine(opening));
        const eb = $("#end-back");
        if (eb) eb.addEventListener("click", () => openOpening(opening.id));
        const el = $("#end-learn");
        if (el && first) el.addEventListener("click", () => startLearn(opening, first));
        return;
      }
      const item = queue[i];
      const choices = uniqueChoices(item);
      named = false; moved = false;
      root.innerHTML =
        "<div class=\"op-page\"><button type=\"button\" class=\"text-btn\" id=\"back-op\">← " + esc(opening.name) + "</button>" +
        "<h2>Which line am I in?</h2>" +
        "<p class=\"muted\">" + (i + 1) + " of " + queue.length + ". Name the situation and the plan, then play the move.</p>" +
        "<div id=\"which-board\" class=\"mini-board\"></div>" +
        "<p class=\"tip-label\">What’s the situation?</p><div id=\"which-choices\" class=\"choices\"></div>" +
        "<div id=\"which-fb\" class=\"drill-fb\" hidden></div></div>";
      $("#back-op").addEventListener("click", () => openOpening(opening.id));
      const board = new window.BoardUI($("#which-board"), {
        flipped: opening.color === "black",
        canMove: () => named && !moved,
        onMove: (spec) => {
          if (!named || moved) return;
          const preview = new Chess(item.fen);
          const mv = preview.move({ from: spec.from, to: spec.to, promotion: spec.promotion || "q" });
          if (!mv) return;
          moved = true;
          const okMove = item.move && (mv.uci === item.move.uci || (mv.from + mv.to + (mv.promotion || "")) === item.move.uci);
          board.setPosition(preview.fen(), mv);
          const fb = $("#which-fb");
          fb.hidden = false;
          fb.className = "drill-fb " + (okMove ? "ok" : "bad");
          fb.innerHTML = (okMove ? "<p>That’s the move. " + esc(item.move.idea || item.plan || "") + "</p>" : "<p>The move in this line is <strong>" + esc(item.move.san) + "</strong>. " + esc(item.move.idea || item.plan || "") + "</p>") +
            "<button type=\"button\" id=\"which-next\">Next</button>";
          $("#which-next").addEventListener("click", () => { i++; show(); });
        }
      });
      board.setPosition(item.fen, null);
      const box = $("#which-choices");
      choices.forEach((c) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "choice";
        b.innerHTML = "<strong>" + esc(c.label) + "</strong><span class=\"muted\"> " + esc(c.plan || "") + "</span>";
        b.addEventListener("click", () => {
          if (named) return;
          named = true;
          $$(".choice", box).forEach((x) => x.classList.remove("on"));
          b.classList.add("on");
          if (c.ok) correct++;
          const fb = $("#which-fb");
          fb.hidden = false;
          fb.className = "drill-fb " + (c.ok ? "ok" : "bad");
          fb.innerHTML = c.ok
            ? "<p>Yes. " + esc(item.plan || "") + " Now play the move on the board.</p>"
            : "<p>This is <strong>" + esc(item.chapter) + "</strong>. " + esc(item.plan || "") + " Now play the move anyway.</p>";
        });
        box.appendChild(b);
      });
    }
    show();
  }

  function startCompare(opening) {
    UI.sub = "compare";
    const root = $("#openings-root");
    const chs = opening.chapters || [];
    root.innerHTML =
      "<div class=\"op-page\"><button type=\"button\" class=\"text-btn\" id=\"back-op\">← " + esc(opening.name) + "</button>" +
      "<h2>Compare two lines</h2>" +
      "<p>Pick two chapters. You’ll see the rule of thumb, the first moves of the main line, and what he’s trying at the first split — so the branches stay related instead of feeling like separate openings.</p>" +
      "<div class=\"compare-picks\"><label>Line A <select id=\"cmp-a\"></select></label> <label>Line B <select id=\"cmp-b\"></select></label> <button type=\"button\" class=\"primary\" id=\"cmp-go\">Compare</button></div>" +
      "<div id=\"cmp-out\" class=\"compare-grid\"></div></div>";
    $("#back-op").addEventListener("click", () => openOpening(opening.id));
    const a = $("#cmp-a"), b = $("#cmp-b");
    chs.forEach((ch, i) => {
      const o1 = document.createElement("option"); o1.value = ch.id; o1.textContent = ch.name; a.appendChild(o1);
      const o2 = document.createElement("option"); o2.value = ch.id; o2.textContent = ch.name; if (i === 1) o2.selected = true; b.appendChild(o2);
    });
    function mainSans(ch, n) {
      const out = [];
      let node = ch.tree || { replies: [] };
      for (let i = 0; i < (n || 10); i++) {
        const reps = node.replies || [];
        const main = reps.find((r) => r.main) || reps[0];
        if (!main) break;
        out.push(main);
        node = main;
      }
      return out;
    }
    function col(ch) {
      const line = mainSans(ch, 12);
      const sm = window.Openings.situationAt(opening, ch, []);
      const split = window.Openings.situationAt(opening, ch, line.slice(0, Math.max(0, line.length - 1)));
      const items = (split && split.items && split.items.length ? split.items : (sm && sm.items) || []);
      return "<article class=\"panel\"><h3>" + esc(ch.name) + "</h3>" +
        "<p class=\"rule\">" + esc(ch.mnemonic) + "</p>" +
        "<p>" + esc(line.map((n) => n.san).join(" ")) + "</p>" +
        (items.length ? "<h4>At the split</h4><ul class=\"sit\">" + items.map((it) =>
          "<li><strong>" + esc(it.move.san) + "</strong> — " + esc(it.intent) +
          (it.answer ? ". You play " + esc(it.answer.san) + (it.reason ? ": " + esc(it.reason) : "") : "") + "</li>"
        ).join("") + "</ul>" : "") +
        ((ch.themes && Object.keys(ch.themes).length) ? "<ul>" + Object.keys(ch.themes).map((k) => "<li><strong>" + esc(k) + ":</strong> " + esc(ch.themes[k]) + "</li>").join("") + "</ul>" : "") +
        "</article>";
    }
    $("#cmp-go").addEventListener("click", () => {
      const ca = window.Openings.chapter(opening.id, a.value);
      const cb = window.Openings.chapter(opening.id, b.value);
      if (!ca || !cb) return;
      $("#cmp-out").innerHTML = col(ca) + col(cb);
    });
    if (chs.length >= 2) $("#cmp-go").click();
  }

  function renderClarity() {
    const root = $("#clarity-root");
    if (!root) return;
    AppChrome.setTitle("Drills");
    AppChrome.setBack(null);
    const C = UI.clarity;
    const cards = [];
    ((C && C.positions) || []).forEach((pos, i) => {
      cards.push("<button type=\"button\" class=\"drill-card\" data-c=\"" + i + "\"><strong>" + esc(pos.title) + "</strong></button>");
    });
    root.innerHTML =
      "<div class=\"op-page\">" +
      "<div class=\"opening-list\" id=\"clarity-list\">" + cards.join("") + "</div>" +
      "<button type=\"button\" class=\"drill-card\" id=\"go-f\"><strong>Fianchetto</strong></button>" +
      "<button type=\"button\" class=\"drill-card\" id=\"go-pirc\"><strong>Pirc / Modern plans</strong></button>" +
      "</div>";
    $$("[data-c]", root).forEach((b) => b.addEventListener("click", () => {
      const pos = ((C && C.positions) || [])[Number(b.getAttribute("data-c"))];
      if (pos) startClarityDrill(pos);
    }));
    const go = $("#go-f", root);
    if (go) go.addEventListener("click", () => { showTab("openings"); UI.sub = "fianchetto"; renderOpenings(); });
    const gp = $("#go-pirc", root);
    if (gp) gp.addEventListener("click", () => { showTab("openings"); UI.sub = "pirc-plans"; renderOpenings(); });
  }

  function startClarityDrill(pos) {
    const root = $("#clarity-root");
    const all = (UI.clarity && UI.clarity.positions) || [];
    const idx = all.findIndex((p) => p.id === pos.id || p.title === pos.title);
    const nextPos = idx >= 0 && idx + 1 < all.length ? all[idx + 1] : null;
    let moved = false;
    let chess;
    try { chess = new Chess(pos.fen); } catch (e) { chess = null; }
    if (!chess) {
      root.innerHTML = "<div class=\"op-page\"><button type=\"button\" class=\"text-btn\" id=\"back-c\">← Clarity</button>" +
        "<h2>" + esc(pos.title) + "</h2><p>This position couldn’t be loaded.</p>" +
        "<div class=\"nav-row\"><button type=\"button\" id=\"c-next\" " + (nextPos ? "" : "hidden") + ">Next drill</button>" +
        "<button type=\"button\" id=\"c-back\">Back to the list</button></div></div>";
      $("#back-c").addEventListener("click", renderClarity);
      const n = $("#c-next"); if (n && nextPos) n.addEventListener("click", () => startClarityDrill(nextPos));
      $("#c-back").addEventListener("click", renderClarity);
      return;
    }
    const cue = words8(pos.movePrompt || "Play the plan.");
    AppChrome.setTitle(pos.title);
    AppChrome.setBack(() => renderClarity());
    const whyHtml = ((pos.steps || []).map((s) => {
      const ans = (s.choices && s.choices[s.correct]) || "";
      return "<p><strong>" + esc(s.question) + "</strong> " + esc(ans) + (s.explain ? " — " + esc(s.explain) : "") + "</p>";
    }).join("")) || "<p>What’s hanging, what’s the threat, then play the plan in the center or on the weak squares.</p>";
    root.innerHTML =
      "<div class=\"op-page\"><button type=\"button\" class=\"text-btn\" id=\"back-c\">← Clarity</button>" +
      "<h2>" + esc(pos.title) + "</h2>" +
      "<p class=\"cue-bar\">" + esc(cue) + " <button type=\"button\" class=\"text-btn why-btn\" id=\"c-why\">Why?</button></p>" +
      "<div id=\"c-why-panel\" class=\"why-panel\" hidden>" + whyHtml + "</div>" +
      "<div class=\"routine-icons\" id=\"c-icons\">" +
      ["S","T","F","P","C"].map(function (lab, i) { return "<button type=\"button\" class=\"routine-icon\" data-i=\"" + i + "\" aria-label=\"Check " + (i+1) + "\">" + lab + "</button>"; }).join("") +
      "</div>" +
      "<div id=\"c-board\" class=\"mini-board\"></div>" +
      "<div id=\"c-fb\" class=\"drill-fb\" hidden></div>" +
      "<div class=\"nav-row\" id=\"c-nav\">" +
      "<button type=\"button\" id=\"c-show\">Show answer</button>" +
      "<button type=\"button\" id=\"c-again\" hidden>Again</button>" +
      (nextPos ? "<button type=\"button\" id=\"c-next\" hidden>Next drill</button>" : "") +
      "<button type=\"button\" id=\"c-play\" hidden>Play it out</button>" +
      "<button type=\"button\" id=\"c-back\" hidden>Back to the list</button>" +
      "</div></div>";
    $("#back-c").addEventListener("click", renderClarity);
    $("#c-why").addEventListener("click", () => {
      const box = $("#c-why-panel");
      box.hidden = !box.hidden;
    });
    $$(".routine-icon", root).forEach((ic) => {
      ic.addEventListener("click", () => {
        ic.classList.toggle("on");
        const box = $("#c-why-panel");
        if (box) box.hidden = false;
      });
    });
    const board = new window.BoardUI($("#c-board"), {
      flipped: pos.side === "black",
      showMaterial: true,
      canMove: () => !moved && chess.turn() === (pos.side === "black" ? "b" : "w"),
      onMove: (spec) => {
        const preview = new Chess(chess.fen());
        const mv = preview.move({ from: spec.from, to: spec.to, promotion: spec.promotion || "q" });
        if (!mv) return;
        moved = true;
        chess.move(mv);
        board.setPosition(chess.fen(), mv);
        const good = (pos.goodMoves || []).indexOf(mv.san) >= 0;
        const fb = $("#c-fb");
        fb.hidden = false;
        fb.className = "drill-fb " + (good ? "ok" : "bad");
        fb.innerHTML = good ? esc(pos.feedbackGood) : esc(pos.feedbackBad) + (mv.san ? " You played " + esc(mv.san) + "." : "");
        doneNav();
      }
    });
    board.setPosition(pos.fen, pos.lastMove || null);
    if (pos.lastMove && pos.lastMove.to) {
      const hi = [{ square: pos.lastMove.to, kind: "last" }];
      if (pos.lastMove.from) hi.push({ square: pos.lastMove.from, kind: "last" });
      board.setHighlights(hi);
    }
    function doneNav() {
      $("#c-show").hidden = true;
      $("#c-again").hidden = false;
      const n = $("#c-next"); if (n) n.hidden = false;
      $("#c-play").hidden = false;
      $("#c-back").hidden = false;
    }
    $("#c-show").addEventListener("click", () => {
      if (moved) return;
      const mv = showAnswerOn(chess, board, pos.goodMoves || []);
      moved = true;
      const fb = $("#c-fb");
      fb.hidden = false;
      fb.innerHTML = "<p>" + esc((pos.goodMoves || []).join(" or ")) + ". " + esc(pos.feedbackGood || "") + "</p>";
      doneNav();
    });
    $("#c-again").addEventListener("click", () => startClarityDrill(pos));
    const n = $("#c-next");
    if (n && nextPos) n.addEventListener("click", () => startClarityDrill(nextPos));
    $("#c-play").addEventListener("click", () => playOutFrom(pos.fen, pos.side, pos.movePrompt));
    $("#c-back").addEventListener("click", renderClarity);
  }


  UI.init = async function (hooks) {
    UI.hooks = hooks || {};
    $$(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.getAttribute("data-tab"))));
    /* Opening and drill data load on first Learn/Drills visit, or when tests call UI.loadData. */
  };
  UI.loadData = loadData;
  UI.showTab = showTab;
  UI.renderOpenings = renderOpenings;
  UI.renderClarity = renderClarity;
  UI.renderFind = renderFind;
  UI.renderPircPlans = renderPircPlans;
  UI.chapterEndHTML = chapterEndHTML;
  UI.showTreeMap = showTreeMap;
  UI.startLearn = startLearn;
  UI.startClarityDrill = startClarityDrill;
  UI.openFianchetto = function () { showTab("openings"); UI.sub = "fianchetto"; renderOpenings(); };
  UI.openPircPlans = function () { showTab("openings"); UI.sub = "pirc-plans"; renderOpenings(); };
  window.UI = UI;
})();
