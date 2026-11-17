/* Today home, Train hub, Connect your account, backup, disconnect. */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function showConnect(root, opts) {
    opts = opts || {};
    root.innerHTML =
      "<div class=\"op-page connect-page\">" +
      "<h2>Connect your account</h2>" +
      "<p class=\"cue-bar\">We’ll download your public games to train you. Stays on this device.</p>" +
      "<label class=\"choice-row\"><input type=\"checkbox\" id=\"cn-own\"> This is my own account</label>" +
      "<label class=\"field\">Username" +
      "<input type=\"text\" id=\"cn-user\" autocomplete=\"username\" autocapitalize=\"off\" spellcheck=\"false\" placeholder=\"your username\">" +
      "</label>" +
      "<div class=\"mode-row\">" +
      "<button type=\"button\" class=\"mode-btn rec\" data-plat=\"lichess\">Lichess</button>" +
      "<button type=\"button\" class=\"mode-btn\" data-plat=\"chesscom\">Chess.com</button>" +
      "</div>" +
      "<div class=\"nav-row\">" +
      "<button type=\"button\" class=\"btn primary\" id=\"cn-go\" disabled>Connect</button>" +
      (opts.onBack ? "<button type=\"button\" class=\"btn\" id=\"cn-back\">Back</button>" : "") +
      "</div>" +
      "<p class=\"ws-why\">Or import a PGN file from any site.</p>" +
      "<input type=\"file\" id=\"cn-pgn\" accept=\".pgn,text/plain\" hidden>" +
      "<button type=\"button\" class=\"text-btn\" id=\"cn-file\">Import a PGN file</button>" +
      "<p class=\"ws-why\" id=\"cn-status\" hidden></p>" +
      "</div>";
    if (window.AppChrome) {
      window.AppChrome.setTitle("Connect");
      window.AppChrome.setBack(opts.onBack || null);
    }
    let platform = "lichess";
    function sync() {
      const own = $("#cn-own", root).checked;
      $("#cn-go", root).disabled = !own;
      root.querySelectorAll("[data-plat]").forEach(function (b) {
        b.classList.toggle("rec", b.getAttribute("data-plat") === platform);
      });
    }
    root.querySelectorAll("[data-plat]").forEach(function (b) {
      b.addEventListener("click", function () { platform = b.getAttribute("data-plat"); sync(); });
    });
    $("#cn-own", root).addEventListener("change", sync);
    if ($("#cn-back", root)) $("#cn-back", root).addEventListener("click", function () { if (opts.onBack) opts.onBack(); });
    async function run(extra) {
      const status = $("#cn-status", root);
      status.hidden = false;
      status.textContent = "Downloading your games…";
      try {
        const result = await window.SCAccount.connect(Object.assign({
          platform: extra && extra.pgn ? "pgn" : platform,
          username: $("#cn-user", root).value,
          ownAccount: $("#cn-own", root).checked
        }, extra || {}));
        status.textContent = "Saved " + result.games + " games on this device.";
        if (window.SCAccount.analyzeQueued && opts.engine) window.SCAccount.analyzeQueued(opts.engine);
        if (opts.onDone) opts.onDone();
      } catch (e) {
        status.textContent = (e && e.message) || "Couldn’t connect. Try a PGN file.";
      }
    }
    $("#cn-go", root).addEventListener("click", function () { run(); });
    $("#cn-file", root).addEventListener("click", function () { $("#cn-pgn", root).click(); });
    $("#cn-pgn", root).addEventListener("change", function (e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function () { run({ pgn: reader.result }); };
      reader.readAsText(f);
    });
    sync();
  }

  function ringSvg(done, total) {
    const t = Math.max(1, total || 10);
    const d = Math.max(0, Math.min(t, done || 0));
    const circ = 2 * Math.PI * 16;
    const dash = (d / t) * circ;
    return "<svg class=\"today-ring\" viewBox=\"0 0 36 36\" aria-hidden=\"true\">" +
      "<circle class=\"ring-bg\" cx=\"18\" cy=\"18\" r=\"16\"></circle>" +
      (d ? "<circle class=\"ring-fg\" cx=\"18\" cy=\"18\" r=\"16\" stroke-dasharray=\"" + dash.toFixed(2) + " " + circ.toFixed(2) + "\"></circle>" : "") +
      "<text x=\"18\" y=\"20.5\" text-anchor=\"middle\">" + d + "/" + t + "</text></svg>";
  }

  function startDueSession(opts, cards) {
    const queue = (cards || []).slice(0, 10);
    let i = 0;
    function run() {
      if (i >= queue.length) {
        if (opts.onDone) opts.onDone();
        return;
      }
      const c = queue[i++];
      if (opts.onThink) {
        opts.onThink({
          fen: c.fen,
          color: c.side || c.color || "white",
          mode: "help",
          onFinished: run
        });
      }
    }
    run();
  }

  /* Before an account is linked: a short welcome, what linking does, and three things to do right now. */
  function renderWelcome(root, opts) {
    const P = window.PROFILES || {};
    const persona = P["gambiteer"] ? "gambiteer" : Object.keys(P)[0];
    const pName = persona && P[persona] ? (P[persona].shortName || P[persona].name) : "a sparring bot";
    const pRating = persona && P[persona] ? (P[persona].ratingLabel || "") : "";
    const piece = (code) => "<img class=\"wl-piece\" src=\"vendor/pieces/cburnett/" + code + ".svg\" alt=\"\" aria-hidden=\"true\" onerror=\"this.remove()\">";
    root.innerHTML =
      "<div class=\"op-page today-page welcome-page\">" +
      "<section class=\"wl-hero\">" +
      "<div class=\"wl-board\" aria-hidden=\"true\"></div>" +
      "<p class=\"wl-eyebrow\">Sparring Coach</p>" +
      "<h2 class=\"wl-title\">Let’s train on your own mistakes.</h2>" +
      "<ul class=\"wl-points\">" +
      "<li><span class=\"wl-dot\" aria-hidden=\"true\">10</span>I build a daily 10 from your games</li>" +
      "<li><span class=\"wl-dot\" aria-hidden=\"true\">⌂</span>Your games stay on this device</li>" +
      "</ul>" +
      "<button type=\"button\" class=\"btn primary wl-cta\" id=\"hm-connect\">Connect your account</button>" +
      "<p class=\"wl-fine\">Lichess, Chess.com, or a PGN file</p>" +
      "</section>" +
      "<h3 class=\"wl-section\">Start now</h3>" +
      "<div class=\"wl-cards\">" +
      "<button type=\"button\" class=\"wl-card\" id=\"td-think\">" +
      "<span class=\"wl-icon\">" + piece("wN") + "</span>" +
      "<span class=\"wl-copy\"><strong>Think With Me</strong><span>One position, step by step</span></span>" +
      "<span class=\"wl-go\" aria-hidden=\"true\">›</span></button>" +
      "<button type=\"button\" class=\"wl-card\" id=\"td-opening\">" +
      "<span class=\"wl-icon\">" + piece("wP") + "</span>" +
      "<span class=\"wl-copy\"><strong>Ponziani</strong><span>Your first White opening</span></span>" +
      "<span class=\"wl-go\" aria-hidden=\"true\">›</span></button>" +
      "<button type=\"button\" class=\"wl-card\" id=\"td-spar\">" +
      "<span class=\"wl-icon\">" + piece("bQ") + "</span>" +
      "<span class=\"wl-copy\"><strong>Spar the " + esc(pName) + "</strong><span>" + esc(pRating ? pRating + " · fast attacks" : "A bot with a style") + "</span></span>" +
      "<span class=\"wl-go\" aria-hidden=\"true\">›</span></button>" +
      "</div>" +
      "</div>";
    if (window.AppChrome) { window.AppChrome.setTitle("Today"); window.AppChrome.setBack(null); }
    $("#td-connect", root).addEventListener("click", function () { showConnect(root, opts); });
    $("#td-think", root).addEventListener("click", function () { if (opts.onThink) opts.onThink(); });
    $("#td-opening", root).addEventListener("click", function () { if (opts.onOpening) opts.onOpening("ponziani"); });
    $("#td-spar", root).addEventListener("click", function () { if (opts.onSpar && persona) opts.onSpar(persona); });
  }

  /* Home: one primary action (the named next step), two tracks, the daily set, a quiet streak. */
  async function renderToday(root, opts) {
    opts = opts || {};
    const acc = window.SCAccount ? await window.SCAccount.getAccount() : null;
    const prog = window.SCAccount ? await window.SCAccount.getProgress() : {};
    const an = window.SCAccount && window.SCAccount.analysisStatus ? window.SCAccount.analysisStatus() : { running: false, done: 0, total: 0, cards: 0 };
    const spots = acc && window.SCAccount ? await window.SCAccount.weakSpots() : [];
    const cards = window.SCDB ? ((await window.SCDB.all("cards")) || []) : [];
    const due = window.SCFSRS ? window.SCFSRS.due(cards) : [];
    const day = window.SCAccount && window.SCAccount.todayKey ? window.SCAccount.todayKey() : "";
    const todayDone = (prog.todayDate === day) ? (prog.todayDone || 0) : 0;
    if (opts.engine && window.SCAccount && window.SCAccount.analyzeQueued && acc) window.SCAccount.analyzeQueued(opts.engine);
    if (acc && window.Badges) window.Badges.scanLinked().catch(function () {});
    if (window.Lessons) await window.Lessons.load().catch(function () {});
    const P = window.Progress ? window.Progress.get() : null;
    const ch = P && P.character;
    const placed = P && (P.placement.status === "done" || P.placement.status === "new");
    const next = window.Journey && window.Lessons && window.Lessons.data() ? window.Journey.nextStep() : null;
    const st = window.Journey && window.Lessons && window.Lessons.data() ? window.Journey.start() : null;
    const lv = window.Progress ? window.Progress.levelOf(P.xp) : { level: 1 };
    const head = "<div class=\"home-head\">" + (window.Adventure ? window.Adventure.avatarSVG(ch, 48) : "") +
      "<div class=\"hh-copy\"><b>" + esc((ch && ch.name) || "Player") + "</b><span class=\"muted\">Level " + lv.level + " · " + esc(window.Progress ? window.Progress.ratingLabel() : "") + "</span></div>" +
      (window.Feel ? window.Feel.streakRing() : "") + "</div>";
    let primary;
    if (!placed && P && P.placement.status !== "later") {
      primary = "<section class=\"home-hero\"><p class=\"wl-eyebrow\">First, your level</p><h2 class=\"wl-title\">Three quick games. Then we know where to start.</h2>" +
        "<button type=\"button\" class=\"primary wl-cta\" id=\"hm-place\">Play placement games</button>" +
        "<div class=\"hero-links\"><button type=\"button\" class=\"text-btn\" id=\"hm-new\">I'm brand new</button><button type=\"button\" class=\"text-btn\" id=\"hm-later\">Later</button></div></section>";
    } else if (next) {
      primary = "<section class=\"home-hero\"><p class=\"wl-eyebrow\">" + esc(st ? st.regionName : "Up next") + "</p>" +
        "<button type=\"button\" class=\"primary wl-cta\" id=\"hm-next\" data-testid=\"session-next-step\">Next: " + esc(next.label) + ", " + next.minutes + " min</button>" +
        (P.placement.status === "later" ? "<button type=\"button\" class=\"text-btn\" id=\"hm-place\">Play placement games</button>" : "") + "</section>";
    } else primary = "";
    const tracks = "<div class=\"home-tracks\">" +
      "<button type=\"button\" class=\"wl-card track-card adv\" data-testid=\"home-adventure\" id=\"hm-adv\"><span class=\"tc-icon\">⛰</span><span class=\"wl-copy\"><strong>Adventure</strong><span>" + esc(st ? st.regionName : "Your journey") + "</span></span></button>" +
      "<button type=\"button\" class=\"wl-card track-card train\" data-testid=\"home-train\" id=\"hm-train\"><span class=\"tc-icon\">♞</span><span class=\"wl-copy\"><strong>Train</strong><span>Lessons, openings, drills</span></span></button></div>";
    let daily;
    if (!acc) {
      daily = "<button type=\"button\" class=\"wl-card daily\" id=\"hm-connect\"><span class=\"tc-icon\">10</span><span class=\"wl-copy\"><strong>Your daily 10</strong><span>Link Lichess, Chess.com or a PGN. Stays on this device.</span></span></button>";
    } else {
      const total = an.total || 0, looked = an.done || prog.analyzed || 0;
      const analyzing = !!(an.running && looked < total);
      const sub = analyzing ? ("Looking at " + looked + " of " + total + " games") : (due.length ? (todayDone + " of 10 done") : "No cards due yet");
      daily = "<button type=\"button\" class=\"wl-card daily\" id=\"hm-daily\"" + (due.length ? "" : " disabled") + ">" + ringSvg(todayDone, 10) +
        "<span class=\"wl-copy\"><strong>Today's 10</strong><span>" + esc(sub) + "</span></span></button>";
      const spot = spots[0];
      if (spot) daily += "<button type=\"button\" class=\"wl-card today-spot\" data-id=\"" + esc(spot.persona) + "\"><span class=\"wl-copy\"><strong>Weak spot: " + esc(spot.when) + "</strong><span>" + esc(spot.record) + " · spar " + esc((window.PROFILES && window.PROFILES[spot.persona] && window.PROFILES[spot.persona].shortName) || spot.persona) + "</span></span></button>";
    }
    root.innerHTML = "<div class=\"op-page today-page home-page\">" + head + primary + tracks + "<h3 class=\"wl-section\">Today</h3><div class=\"wl-cards\">" + daily + "</div></div>";
    if (window.AppChrome) { window.AppChrome.setTitle("Home"); window.AppChrome.setBack(null); }
    const on = (id, fn) => { const el = $("#" + id, root); if (el) el.addEventListener("click", fn); };
    on("hm-place", () => window.Adventure && window.Adventure.startPlacement());
    on("hm-new", () => { window.Adventure.brandNew(); renderToday(root, opts); });
    on("hm-later", () => { window.Adventure.playLater(); renderToday(root, opts); });
    on("hm-next", () => next && next.go());
    on("hm-adv", () => opts.onAdventure && opts.onAdventure());
    on("hm-train", () => opts.onTrain && opts.onTrain());
    on("hm-connect", () => showConnect(root, opts));
    on("hm-daily", () => { if (due.length) startDueSession(opts, due); });
    const spotBtn = root.querySelector(".today-spot[data-id]");
    if (spotBtn) spotBtn.addEventListener("click", function () { if (opts.onSpar) opts.onSpar(spotBtn.getAttribute("data-id")); });
  }

  /* Train: direct access, no story. Lessons library, openings, drills, Think With Me, Rush, review. */
  function reviewSub() {
    const n = window.Lessons && window.Lessons.reviewDue ? window.Lessons.reviewDue() : 0;
    return n ? n + " missed position" + (n > 1 ? "s" : "") + " due" : "Missed positions come back here";
  }
  function renderTrain(root, opts) {
    opts = opts || {};
    const OPEN = [["ponziani", "Ponziani", "White"], ["vienna", "Vienna", "White"], ["scotch", "Scotch", "White"], ["alapin", "Alapin vs Sicilian", "White"], ["caro", "Caro-Kann", "Black"], ["pirc", "Pirc", "Black"], ["rousseau", "Rousseau", "Black"]];
    root.innerHTML =
      "<div class=\"op-page train-hub\">" +
      "<h3 class=\"wl-section\">Openings</h3><div class=\"tr-open\">" + OPEN.map(function (o) {
        return "<button type=\"button\" class=\"opening-card tr-op\" data-op=\"" + o[0] + "\"><strong>" + esc(o[1]) + "</strong><span>" + o[2] + "</span></button>";
      }).join("") + "</div>" +
      "<h3 class=\"wl-section\">Practice</h3><div class=\"tr-tools\">" +
      "<button type=\"button\" class=\"drill-card\" id=\"tr-games\" data-testid=\"train-own-games\"><strong>Your games</strong><span id=\"tr-games-sub\">Drills from your own mistakes</span></button>" +
      "<button type=\"button\" class=\"drill-card\" id=\"tr-review\" data-testid=\"train-review\"><strong>Review</strong><span id=\"tr-review-sub\">" + reviewSub() + "</span></button>" +
      "<button type=\"button\" class=\"drill-card\" id=\"tr-think\"><strong>Think With Me</strong><span>One position, out loud</span></button>" +
      "<button type=\"button\" class=\"drill-card\" id=\"tr-rush\" data-testid=\"rush-open\"><strong>Rush</strong><span>3 minutes, 3 strikes</span></button>" +
      "<button type=\"button\" class=\"drill-card\" id=\"tr-drills\"><strong>Drills</strong><span>Plans and clarity</span></button>" +
      "<button type=\"button\" class=\"drill-card\" id=\"tr-lessons\"><strong>All openings</strong><span>Guided and Solo</span></button>" +
      (window.Packs ? window.Packs.list().filter(function (p) { return p.kind === "weekly-puzzles"; }).slice(0, 1).map(function (p) {
        return "<button type=\"button\" class=\"drill-card\" data-pack=\"" + esc(p.id) + "\" data-testid=\"pack-card\"><strong>" + esc(p.title) + "</strong><span>" + p.items + " positions</span></button>";
      }).join("") : "") + "</div>" +
      "<h3 class=\"wl-section\">Lessons</h3><div id=\"tr-lib\"></div></div>";
    if (window.AppChrome) { window.AppChrome.setTitle("Train"); window.AppChrome.setBack(null); }
    root.querySelectorAll("[data-op]").forEach(function (b) { b.addEventListener("click", function () { if (opts.onOpening) opts.onOpening(b.getAttribute("data-op")); }); });
    $("#tr-think", root).addEventListener("click", function () { if (opts.onThink) opts.onThink(); });
    $("#tr-lessons", root).addEventListener("click", function () { if (opts.onLessons) opts.onLessons(); });
    $("#tr-drills", root).addEventListener("click", function () { if (opts.onDrills) opts.onDrills(); });
    $("#tr-rush", root).addEventListener("click", function () { if (window.Rush) window.Rush.open(); });
    $("#tr-review", root).addEventListener("click", function () {
      if (window.Lessons && window.Lessons.startReview()) return;
      $("#tr-review-sub", root).textContent = "Nothing due. Lesson misses land here.";
    });
    let ownDue = [], ownAcc = null;
    (async function () {
      try {
        ownAcc = window.SCAccount ? await window.SCAccount.getAccount() : null;
        const cards = window.SCDB ? ((await window.SCDB.all("cards")) || []) : [];
        ownDue = window.SCFSRS ? window.SCFSRS.due(cards) : [];
        const sub = $("#tr-games-sub", root);
        if (sub) sub.textContent = !ownAcc ? "Link an account to drill your games" : ownDue.length ? ownDue.length + " positions due" : "Nothing due yet";
      } catch (e) {}
    })();
    $("#tr-games", root).addEventListener("click", function () {
      if (!ownAcc) return showConnect(root, Object.assign({}, opts, { onDone: opts.onDone, onBack: opts.onDone }));
      if (ownDue.length) return startDueSession(opts, ownDue);
      $("#tr-games-sub", root).textContent = "Nothing due. Play a game, then check back.";
    });
    root.querySelectorAll("[data-pack]").forEach(function (b) { b.addEventListener("click", function () { window.Packs.start(b.getAttribute("data-pack")); }); });
    if (window.Lessons) window.Lessons.renderHub($("#tr-lib", root));
  }

  async function fillSettings(host, opts) {
    if (!host) return;
    let box = host.querySelector("#sc-account-tools");
    if (!box) {
      box = document.createElement("div");
      box.id = "sc-account-tools";
      box.className = "account-tools";
      host.appendChild(box);
    }
    const acc = window.SCAccount ? await window.SCAccount.getAccount() : null;
    box.innerHTML =
      (acc
        ? "<p class=\"ws-why\">Linked as " + esc(acc.username) + " on " + esc(acc.platform === "chesscom" ? "Chess.com" : acc.platform === "lichess" ? "Lichess" : "a PGN file") + ".</p>" +
          "<div class=\"nav-row\"><button type=\"button\" class=\"btn\" id=\"sc-export\">Export backup</button>" +
          "<button type=\"button\" class=\"btn\" id=\"sc-import\">Import backup</button></div>" +
          "<button type=\"button\" class=\"text-btn danger\" id=\"sc-wipe\">Disconnect and delete my data</button>"
        : "<button type=\"button\" class=\"btn\" id=\"sc-connect\">Connect your account</button>" +
          "<div class=\"nav-row\"><button type=\"button\" class=\"btn\" id=\"sc-import\">Import backup</button></div>") +
      "<input type=\"file\" id=\"sc-file\" accept=\"application/json,.json\" hidden>";
    function download(obj) {
      const blob = new Blob([JSON.stringify(obj)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "sparring-coach-backup.json";
      a.click();
    }
    if ($("#sc-export", box)) $("#sc-export", box).addEventListener("click", async function () {
      download(await window.SCAccount.exportAll());
    });
    if ($("#sc-import", box)) $("#sc-import", box).addEventListener("click", function () { $("#sc-file", box).click(); });
    $("#sc-file", box).addEventListener("change", async function (e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        await window.SCAccount.importAll(data);
        box.querySelector("p, .ws-why") && (window.location.hash = "#refreshed");
        if (opts.onChange) opts.onChange();
      } catch (err) { alert((err && err.message) || "Couldn’t import that file."); }
    });
    if ($("#sc-wipe", box)) $("#sc-wipe", box).addEventListener("click", async function () {
      if (!confirm("Delete your games, cards, and stats from this device?")) return;
      await window.SCAccount.disconnectAndDelete();
      if (opts.onChange) opts.onChange();
    });
    if ($("#sc-connect", box)) $("#sc-connect", box).addEventListener("click", function () {
      if (opts.onConnect) opts.onConnect();
    });
  }

  window.SCToday = { renderToday, renderTrain, showConnect, fillSettings };
})();
