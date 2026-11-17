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

  async function renderToday(root, opts) {
    opts = opts || {};
    const acc = window.SCAccount ? await window.SCAccount.getAccount() : null;
    const prog = window.SCAccount ? await window.SCAccount.getProgress() : {};
    const an = window.SCAccount && window.SCAccount.analysisStatus ? window.SCAccount.analysisStatus() : { running: false, done: 0, total: 0, cards: 0 };
    const spots = window.SCAccount ? await window.SCAccount.weakSpots() : [];
    const cards = window.SCDB ? ((await window.SCDB.all("cards")) || []) : [];
    const due = window.SCFSRS ? window.SCFSRS.due(cards) : [];
    const day = window.SCAccount && window.SCAccount.todayKey ? window.SCAccount.todayKey() : "";
    const todayDone = (prog.todayDate === day) ? (prog.todayDone || 0) : 0;
    if (opts.engine && window.SCAccount && window.SCAccount.analyzeQueued && acc) {
      window.SCAccount.analyzeQueued(opts.engine);
    }
    if (!acc) {
      root.innerHTML =
        "<div class=\"op-page today-page\">" +
        "<p class=\"cue-bar\">Train from your own games.</p>" +
        "<button type=\"button\" class=\"btn primary\" id=\"td-connect\">Connect your account</button>" +
        "<button type=\"button\" class=\"text-btn\" id=\"td-think\">Or start a Think With Me rep</button>" +
        "</div>";
      $("#td-connect", root).addEventListener("click", function () { showConnect(root, opts); });
      if ($("#td-think", root)) $("#td-think", root).addEventListener("click", function () { if (opts.onThink) opts.onThink(); });
      if (window.AppChrome) { window.AppChrome.setTitle("Today"); window.AppChrome.setBack(null); }
      return;
    }
    const total = an.total || 0;
    const looked = an.done || prog.analyzed || 0;
    const streak = prog.streak || 0;
    const strip = "<div class=\"today-strip\">" +
      "<span class=\"strip-name\">" + esc(acc.username) + "</span>" +
      "<span>" + (streak ? streak + "-day streak" : "Streak starts today") + "</span>" +
      "<span>" + looked + (total && looked < total ? " of " + total : "") + " looked at</span></div>";
    const analyzing = !!(an.running && looked < total);
    const goal = 10;
    const canStart = due.length > 0;
    const pct = total ? Math.round((looked / total) * 100) : 0;
    let hero;
    if (analyzing && !canStart) {
      hero = "<div class=\"today-hero idle\" id=\"td-hero\">" +
        "<div class=\"hero-copy\"><strong>Looking at " + Math.max(looked, an.current || looked) + " of " + total + "</strong>" +
        "<span>Finding mistakes in your games</span></div>" +
        "<div class=\"thin-progress\" id=\"td-bar\"><span style=\"width:" + pct + "%\"></span></div></div>";
    } else {
      const sub = analyzing
        ? ("Looking at " + looked + " of " + total)
        : (canStart ? (todayDone + " of " + goal + " done") : "No due cards yet");
      hero = "<button type=\"button\" class=\"today-hero" + (canStart ? "" : " idle") + "\" id=\"td-start\"" + (canStart ? "" : " disabled") + ">" +
        ringSvg(todayDone, goal) +
        "<div class=\"hero-copy\"><strong>Start today's " + goal + "</strong><span>" + esc(sub) + "</span></div></button>";
      if (analyzing) {
        hero += "<div class=\"thin-progress\" id=\"td-bar\"><span style=\"width:" + pct + "%\"></span></div>";
      }
    }
    const spot = spots[0];
    const spotHtml = spot
      ? "<button type=\"button\" class=\"today-spot\" data-id=\"" + esc(spot.persona) + "\">" +
        "<span class=\"ws-when\">" + esc(spot.when) + " · " + esc(spot.record) +
        " <span class=\"text-btn why-btn\" id=\"td-why\">Why?</span></span>" +
        "<span class=\"ws-go\">Spar " + esc((window.PROFILES && window.PROFILES[spot.persona] && window.PROFILES[spot.persona].shortName) || spot.persona) + "</span></button>" +
        "<p class=\"ws-why\" id=\"td-why-text\" hidden>From your linked games, grouped by ECO family.</p>"
      : (analyzing
        ? "<p class=\"ws-why\">Weak spots appear as more games are counted.</p>"
        : "<p class=\"ws-why\">Not enough games in one family yet.</p>");
    root.innerHTML =
      "<div class=\"op-page today-page\">" +
      strip + hero +
      "<div class=\"today-spot-wrap\">" + spotHtml + "</div></div>";
    if (window.AppChrome) { window.AppChrome.setTitle("Today"); window.AppChrome.setBack(null); }
    const why = $("#td-why", root);
    const whyText = $("#td-why-text", root);
    if (why && whyText) why.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); whyText.hidden = !whyText.hidden; });
    const start = $("#td-start", root);
    if (start && canStart) start.addEventListener("click", function () { startDueSession(opts, due); });
    const spotBtn = root.querySelector(".today-spot[data-id]");
    if (spotBtn) spotBtn.addEventListener("click", function () {
      if (opts.onSpar) opts.onSpar(spotBtn.getAttribute("data-id"));
    });
  }

  function renderTrain(root, opts) {
    opts = opts || {};
    root.innerHTML =
      "<div class=\"op-page train-hub\">" +
      "<button type=\"button\" class=\"opening-card\" id=\"tr-think\"><strong>Think With Me</strong><span>Watch, then with help, then alone.</span></button>" +
      "<button type=\"button\" class=\"opening-card\" id=\"tr-lessons\"><strong>Lessons</strong><span>Guided and Solo opening work.</span></button>" +
      "<button type=\"button\" class=\"opening-card\" id=\"tr-drills\"><strong>Drills</strong><span>Clarity, plans, and pick-the-plan.</span></button>" +
      "</div>";
    if (window.AppChrome) { window.AppChrome.setTitle("Train"); window.AppChrome.setBack(null); }
    $("#tr-think", root).addEventListener("click", function () { if (opts.onThink) opts.onThink(); });
    $("#tr-lessons", root).addEventListener("click", function () { if (opts.onLessons) opts.onLessons(); });
    $("#tr-drills", root).addEventListener("click", function () { if (opts.onDrills) opts.onDrills(); });
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
