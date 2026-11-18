/* Connect your account: fetch only the linked user's own public games, store on device. */
(function () {
  const MAX_GAMES = 400;
  const MIN_FAMILY_GAMES = 15;
  const FALLBACK_FAMILY_GAMES = 5;
  const MISTAKE_CP = 150;
  const UA = "SparringCoach/1.6.1 (educational chess trainer; +https://blaketj13.github.io/chess-coach)";
  const listeners = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function notify() { listeners.forEach((fn) => { try { fn(); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

  function safeName(s) {
    return String(s || "").trim().replace(/^@/, "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  }

  function headers(extra) {
    const h = Object.assign({ "User-Agent": UA }, extra || {});
    return h;
  }

  async function getAccount() {
    try { return (await window.SCDB.get("meta", "account")) || null; } catch (e) { return null; }
  }
  async function getProgress() {
    try {
      return (await window.SCDB.get("progress", "main")) || emptyProgress();
    } catch (e) { return emptyProgress(); }
  }
  function emptyProgress() {
    return { analyzed: 0, thinkDone: 0, drillsDone: 0, streak: 0, todayDone: 0, todayDate: "", lastStreakDay: "" };
  }
  function todayKey(d) {
    const x = d || new Date();
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  }
  async function setProgress(p) { await window.SCDB.set("progress", "main", p); notify(); }

  function prettyOpening(name) {
    let s = String(name || "").replace(/\.{2,}.*$/, "").replace(/\s+\d.*$/, "").trim();
    s = s.replace(/\bKings\b/g, "King's").replace(/\bQueens\b/g, "Queen's").replace(/\bBishops\b/g, "Bishop's");
    if (/^King's Pawn Opening/i.test(s)) return "1.e4 e5";
    if (/^Queen's Pawn Opening/i.test(s)) return "1.d4";
    return s || "Other";
  }

  function openingFromTags(tags) {
    const named = tags.Opening || "";
    if (named && !/^https?:/i.test(named)) return prettyOpening(named);
    const url = tags.ECOUrl || named;
    const m = String(url || "").match(/openings\/([^/?#]+)/i);
    if (m) {
      return prettyOpening(decodeURIComponent(m[1]).replace(/\.{2,}.*$/, "").replace(/-\d.*$/, "").replace(/-/g, " ").trim() || "Other");
    }
    return tags.ECO || "Other";
  }

  /* Group by ECO family, with a readable label and a matching style persona. */
  function ecoFamily(eco, opening) {
    const e = String(eco || "").toUpperCase();
    const o = String(opening || "").toLowerCase();
    const n = parseInt(e.slice(1), 10);
    const letter = e.charAt(0);
    if (/london/.test(o) || e === "D02" || (e === "D00" && /london/.test(o))) {
      return { id: "london", name: "the London", persona: "solid-defender" };
    }
    if (/polish|sokolsky|1\.b4/.test(o)) return { id: "sokolsky", name: "1.b4", persona: "wing-pawn-opener" };
    if (/larsen|1\.b3/.test(o)) return { id: "larsen", name: "1.b3", persona: "wing-pawn-opener" };
    if (/caro/.test(o) || (letter === "B" && n >= 10 && n <= 19)) return { id: "caro-kann", name: "the Caro-Kann", persona: "solid-defender" };
    if (/sicilian|alapin/.test(o) || (letter === "B" && n >= 20 && n <= 99)) return { id: "sicilian", name: "the Sicilian", persona: "solid-defender" };
    if (/french/.test(o) || (letter === "C" && n <= 19)) return { id: "french", name: "the French", persona: "solid-defender" };
    if (/pirc|robatsch/.test(o) || (letter === "B" && n >= 7 && n <= 9)) return { id: "pirc", name: "the Pirc", persona: "fianchetto-grinder" };
    if (/modern/.test(o) || e === "B06") return { id: "modern", name: "the Modern", persona: "fianchetto-grinder" };
    if (/scandinavian|center counter/.test(o) || e === "B01") return { id: "scandinavian", name: "the Scandinavian", persona: "solid-defender" };
    if (/vienna/.test(o) || (letter === "C" && n >= 25 && n <= 29)) return { id: "vienna", name: "the Vienna", persona: "gambiteer" };
    if (/scotch/.test(o) || (letter === "C" && n >= 44 && n <= 45)) return { id: "scotch", name: "the Scotch", persona: "solid-defender" };
    if (/ponziani/.test(o) || e === "C44") return { id: "ponziani", name: "the Ponziani", persona: "solid-defender" };
    if (/italian|giuoco|two knights|evans|rousseau|guioco/.test(o) || (letter === "C" && n >= 50 && n <= 59)) return { id: "italian", name: "the Italian", persona: "gambiteer" };
    if (/ruy|spanish|jaenisch|schliemann/.test(o) || (letter === "C" && n >= 60 && n <= 99)) return { id: "ruy", name: "the Ruy Lopez", persona: "solid-defender" };
    if (/king'?s gambit/.test(o) || (letter === "C" && n >= 30 && n <= 39)) return { id: "kings-gambit", name: "the King's Gambit", persona: "gambiteer" };
    if (/english/.test(o) || (letter === "A" && n >= 10 && n <= 39)) return { id: "english", name: "the English", persona: "fianchetto-grinder" };
    if (/r[ée]ti/.test(o) || (letter === "A" && n >= 4 && n <= 9)) return { id: "reti", name: "the Réti", persona: "fianchetto-grinder" };
    if (/queen'?s gambit|qgd|qga|slav|tarrasch/.test(o) || (letter === "D" && n >= 6 && n <= 69)) return { id: "qgd", name: "the Queen's Gambit", persona: "solid-defender" };
    if (/gr[uü]nfeld/.test(o) || (letter === "D" && n >= 70 && n <= 99)) return { id: "grunfeld", name: "the Grünfeld", persona: "fianchetto-grinder" };
    if (/nimzo|queen'?s indian|king'?s indian|bogo|catalan|indian/.test(o) || letter === "E" || (letter === "A" && n >= 45 && n <= 79)) {
      return { id: "indian", name: "an Indian defense", persona: "fianchetto-grinder" };
    }
    if (/dutch/.test(o) || (letter === "A" && n >= 80 && n <= 99)) return { id: "dutch", name: "the Dutch", persona: "gambiteer" };
    if (/gambit/.test(o)) return { id: "gambit", name: "a gambit", persona: "gambiteer" };
    if (letter === "C" && n >= 20 && n <= 99) return { id: "open-e4e5", name: "1.e4 e5", persona: "solid-defender" };
    if (letter === "B" && n <= 9) return { id: "uncommon-e4", name: "an uncommon reply to 1.e4", persona: "wing-pawn-opener" };
    if (letter === "A" && n <= 3) return { id: "irregular", name: "an irregular first move", persona: "wing-pawn-opener" };
    if (letter === "D") return { id: "queens-pawn", name: "1.d4", persona: "solid-defender" };
    return { id: "other", name: prettyOpening(opening) || "other lines", persona: personaFor(opening) };
  }

  function parsePgnGames(text) {
    const raw = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!raw) return [];
    const chunks = raw.split(/\n\s*\n(?=\[Event)/);
    const games = [];
    chunks.forEach((chunk, i) => {
      const block = chunk.trim();
      if (!block) return;
      const tags = {};
      block.replace(/\[(\w+)\s+"([^"]*)"\]/g, function (_, k, v) { tags[k] = v; return ""; });
      const white = tags.White || "";
      const black = tags.Black || "";
      const result = tags.Result || "";
      const opening = openingFromTags(tags);
      const eco = (tags.ECO || "").toUpperCase();
      const date = tags.UTCDate || tags.Date || "";
      const site = tags.Site || tags.Event || "";
      const id = tags.Site && tags.Date ? (tags.Site + ":" + date + ":" + white + "-" + black).slice(0, 160) : "pgn-" + i + "-" + date + "-" + (white || i);
      games.push({ id, pgn: block, white, black, result, opening, eco, date, site, analyzed: false });
    });
    return games;
  }

  function colorAndScore(game, username) {
    const me = String(username || "").toLowerCase();
    const w = (game.white || "").toLowerCase();
    const b = (game.black || "").toLowerCase();
    let color = null;
    if (w === me) color = "white";
    else if (b === me) color = "black";
    if (!color) return { color: null, win: false, loss: false, draw: false };
    const r = game.result || "";
    const win = (color === "white" && r === "1-0") || (color === "black" && r === "0-1");
    const loss = (color === "white" && r === "0-1") || (color === "black" && r === "1-0");
    const draw = r === "1/2-1/2";
    return { color, win, loss, draw };
  }

  function personaFor(opening) {
    const s = String(opening || "").toLowerCase();
    if (/polish|sokolsky|larsen|fianchetto|modern|pirc|robatsch|réti|reti|king'?s indian|catalan|g3|b4|benko/.test(s)) return "fianchetto-grinder";
    if (/gambit|evans|danish|morra|latvian|budapest|marshall|vienna gambit|king'?s gambit/.test(s)) return "gambiteer";
    if (/ware|anderssen|clemenz|kadas|durkin|irregular|a4|h4|ammonia|amar/.test(s)) return "wing-pawn-opener";
    return "solid-defender";
  }

  function familyOf(opening, eco) {
    return ecoFamily(eco, opening).id;
  }

  async function openingStats() {
    const acc = await getAccount();
    const games = (await window.SCDB.all("games")) || [];
    const byFamily = {};
    if (!acc) return { games: 0, byFamily: byFamily };
    games.forEach(function (g) {
      const sc = colorAndScore(g, acc.username);
      if (!sc.color) return;
      const fam = familyOf(g.opening, g.eco);
      if (!fam) return;
      if (!byFamily[fam]) byFamily[fam] = {};
      if (!byFamily[fam][sc.color]) byFamily[fam][sc.color] = { games: 0, wins: 0, draws: 0, losses: 0 };
      const st = byFamily[fam][sc.color];
      st.games++;
      if (sc.win) st.wins++;
      else if (sc.draw) st.draws++;
      else if (sc.loss) st.losses++;
    });
    Object.keys(byFamily).forEach(function (f) {
      ["white", "black"].forEach(function (c) {
        const st = byFamily[f][c];
        if (st && st.games) st.winRate = Math.round((1000 * (st.wins + 0.5 * st.draws)) / st.games) / 10;
      });
    });
    return { games: games.length, byFamily: byFamily };
  }


  /* Families the player typically chooses with that color, not ones they face. */
  const OURS_AS = {
    white: { london:1, sokolsky:1, larsen:1, vienna:1, ponziani:1, scotch:1, english:1, reti:1, "kings-gambit":1, "queens-pawn":1 },
    black: { "caro-kann":1, sicilian:1, french:1, pirc:1, modern:1, scandinavian:1, italian:1, ruy:1, qgd:1, grunfeld:1, indian:1, dutch:1, petrov:1 }
  };

  function familyTitle(name) {
    return String(name || "").replace(/^(the|an|a)\s+/i, "").trim() || "this line";
  }

  function recordLine(wins, draws, losses, games) {
    const w = wins || 0, d = draws || 0, g = games || 0;
    const winWord = w === 1 ? "win" : "wins";
    if (d > 0) {
      const drawWord = d === 1 ? "draw" : "draws";
      return w + " " + winWord + ", " + d + " " + drawWord + " in " + g;
    }
    return w + " " + winWord + " in " + g;
  }

  function spotLabel(fam, color, wins, draws, losses, games) {
    const side = color === "black" ? "Black" : "White";
    const ours = !!(OURS_AS[color] && OURS_AS[color][fam.id]);
    const when = ours
      ? ("Your " + familyTitle(fam.name) + " as " + side)
      : ((color === "black" ? "As Black vs " : "As White vs ") + fam.name);
    return { when: when, record: recordLine(wins, draws, losses, games) };
  }

  async function weakSpots() {
    const acc = await getAccount();
    const games = (await window.SCDB.all("games")) || [];
    if (!acc || !games.length) return [];
    const by = {};
    games.forEach((g) => {
      const sc = colorAndScore(g, acc.username);
      if (!sc.color) return;
      const fam = ecoFamily(g.eco, g.opening);
      const key = sc.color + "::" + fam.id;
      if (!by[key]) {
        by[key] = {
          id: fam.id,
          name: fam.name,
          persona: fam.persona || personaFor(g.opening),
          games: 0, wins: 0, losses: 0, draws: 0, color: sc.color
        };
      }
      by[key].games++;
      if (sc.win) by[key].wins++;
      else if (sc.loss) by[key].losses++;
      else by[key].draws++;
    });
    const rows = Object.keys(by).map((k) => {
      const s = by[k];
      const label = spotLabel({ id: s.id, name: s.name }, s.color, s.wins, s.draws, s.losses, s.games);
      s.when = label.when;
      s.record = label.record;
      s.winRate = s.games ? Math.round((1000 * (s.wins + 0.5 * (s.draws || 0))) / s.games) / 10 : 0;
      return s;
    }).sort((a, b) => a.winRate - b.winRate || b.games - a.games);
    const weak = (list) => list.filter((s) => s.winRate < 50);
    const strong = weak(rows.filter((s) => s.games >= MIN_FAMILY_GAMES));
    const pick = strong.length ? strong : weak(rows.filter((s) => s.games >= FALLBACK_FAMILY_GAMES));
    return (pick.length ? pick : weak(rows).length ? weak(rows) : rows.slice(0, 1)).slice(0, 3);
  }

  async function fetchWithRetry(url, extraHeaders, attempt) {
    attempt = attempt || 0;
    const opts = { headers: headers(extraHeaders) };
    const res = await fetch(url, opts);
    if (res.status === 429 && attempt < 5) {
      const ra = parseInt(res.headers.get("Retry-After") || "", 10);
      await sleep(((isFinite(ra) ? ra : Math.pow(2, attempt + 1)) * 1000) + 250);
      return fetchWithRetry(url, extraHeaders, attempt + 1);
    }
    if (!res.ok) throw new Error("Couldn’t reach that site (" + res.status + "). You can import a PGN file instead.");
    return res;
  }

  function monthsAgo(n) {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return d;
  }

  async function fetchLichess(username) {
    const since = monthsAgo(6).getTime();
    const base = "https://lichess.org/api/games/user/" + encodeURIComponent(username) +
      "?moves=true&opening=true&sort=dateDesc&clocks=false&evals=false&pgnInJson=false";
    let res = await fetchWithRetry(base + "&max=" + MAX_GAMES + "&since=" + since, { Accept: "application/x-chess-pgn" });
    let games = parsePgnGames(await res.text());
    if (games.length < 200) {
      res = await fetchWithRetry(base + "&max=" + MAX_GAMES, { Accept: "application/x-chess-pgn" });
      games = parsePgnGames(await res.text());
    }
    return games.slice(0, MAX_GAMES);
  }

  async function fetchChessCom(username) {
    const root = "https://api.chess.com/pub/player/" + encodeURIComponent(username) + "/games/archives";
    const res = await fetchWithRetry(root, { Accept: "application/json" });
    const data = await res.json();
    const archives = (data.archives || []).slice().reverse();
    const cutoff = monthsAgo(6);
    const cutoffKey = cutoff.getFullYear() + "/" + String(cutoff.getMonth() + 1).padStart(2, "0");
    const recent = [];
    const older = [];
    archives.forEach(function (url) {
      const m = String(url).match(/(\d{4})\/(\d{2})$/);
      const key = m ? m[1] + "/" + m[2] : "";
      if (key >= cutoffKey) recent.push(url);
      else older.push(url);
    });
    const ordered = recent.concat(older);
    const games = [];
    for (let i = 0; i < ordered.length && games.length < MAX_GAMES; i++) {
      if (i) await sleep(200);
      const ar = await fetchWithRetry(ordered[i] + "/pgn", { Accept: "application/x-chess-pgn" });
      const more = parsePgnGames(await ar.text());
      more.forEach((g) => { if (games.length < MAX_GAMES) games.push(g); });
    }
    return games;
  }

  async function saveGames(games) {
    for (let i = 0; i < games.length; i++) {
      await window.SCDB.set("games", games[i].id, games[i]);
    }
  }

  function mistakeCardsFromGame(game, username, engineDrops) {
    const sc = colorAndScore(game, username);
    if (!sc.color) return [];
    return (engineDrops || []).map((d, i) => window.SCFSRS.newCard({
      id: game.id + ":" + i + ":" + (d.ply || i),
      fen: d.fen,
      move: d.best,
      played: d.played,
      drop: d.drop,
      opening: game.opening,
      persona: personaFor(game.opening),
      side: sc.color
    }));
  }

  function cpFor(res, forColor, sideToMove) {
    const pv = res && res.pvs && res.pvs[0];
    if (!pv) return null;
    let s;
    if (pv.isMate) {
      const m = pv.score;
      s = m === 0 ? 0 : (m > 0 ? 10000 - m : -10000 - m);
    } else {
      s = pv.score;
    }
    if (sideToMove !== forColor) s = -s;
    return s;
  }

  /* Incremental analysis in the Stockfish worker. One game at a time, short searches, yields to the UI. */
  let analyzing = false;
  let paused = false;
  let lastEngine = null;
  const status = { running: false, done: 0, total: 0, cards: 0, current: 0 };
  function analysisStatus() { return Object.assign({}, status); }
  function pauseAnalysis() { paused = true; }
  function resumeAnalysis(engine) {
    paused = false;
    analyzeQueued(engine || lastEngine);
  }

  async function refreshStatusCounts() {
    const games = (await window.SCDB.all("games")) || [];
    const cards = (await window.SCDB.all("cards")) || [];
    status.total = games.length;
    status.done = games.filter((g) => g.analyzed).length;
    status.cards = cards.length;
  }

  async function analyzeQueued(engine) {
    if (engine) lastEngine = engine;
    if (paused || analyzing || !engine || !engine.analyze) return;
    analyzing = true;
    status.running = true;
    try {
      const acc = await getAccount();
      if (!acc) return;
      await refreshStatusCounts();
      notify();
      const games = (await window.SCDB.all("games")) || [];
      const pending = games.filter((g) => !g.analyzed);
      for (let i = 0; i < pending.length; i++) {
        if (paused) break;
        const g = pending[i];
        status.current = status.done + 1;
        const sc = colorAndScore(g, acc.username);
        const drops = [];
        try {
          if (window.Chess && g.pgn && sc.color) {
            const ch = new window.Chess();
            if (!ch.load_pgn(g.pgn, { sloppy: true })) {
              g.analyzed = true;
              await window.SCDB.set("games", g.id, g);
              status.done++;
              continue;
            }
            const hist = ch.history({ verbose: true });
            ch.reset();
            const us = sc.color === "black" ? "b" : "w";
            for (let p = 0; p < hist.length && p < 30 && drops.length < 3; p++) {
              if (paused) break;
              const mv = hist[p];
              if (mv.color === us) {
                const fen = ch.fen();
                const played = (mv.from + mv.to + (mv.promotion || "")).toLowerCase();
                try {
                  const before = await engine.analyze(fen, { movetime: 45, depth: 7, multipv: 1 });
                  const best = before && before.bestmove && before.bestmove.toLowerCase();
                  if (best && played && best !== played) {
                    ch.move(mv);
                    const afterFen = ch.fen();
                    ch.undo();
                    const after = await engine.analyze(afterFen, { movetime: 45, depth: 7, multipv: 1 });
                    const beforeCp = cpFor(before, us, us);
                    const afterCp = cpFor(after, us, us === "w" ? "b" : "w");
                    const drop = (beforeCp != null && afterCp != null) ? (beforeCp - afterCp) : 0;
                    if (drop >= MISTAKE_CP) {
                      drops.push({ fen, best, played, ply: p, drop: Math.round(drop) });
                    }
                  }
                } catch (e) {}
              }
              ch.move(mv);
              await sleep(0);
            }
          }
        } catch (e) {}
        g.analyzed = true;
        g.mistakeCount = drops.length;
        await window.SCDB.set("games", g.id, g);
        const cards = mistakeCardsFromGame(g, acc.username, drops);
        for (let c = 0; c < cards.length; c++) await window.SCDB.set("cards", cards[c].id, cards[c]);
        const prog = await getProgress();
        prog.analyzed = (prog.analyzed || 0) + 1;
        await window.SCDB.set("progress", "main", prog);
        status.done++;
        status.cards += cards.length;
        notify();
      }
    } finally {
      analyzing = false;
      status.running = false;
      try { await refreshStatusCounts(); } catch (e) {}
      notify();
    }
  }

  async function connect(opts) {
    const typed = safeName(opts && opts.username);
    const platform = (opts && opts.platform) || "lichess";
    if (!opts || !opts.ownAccount) throw new Error("Please confirm this is your own account.");
    if (!typed && platform !== "pgn") throw new Error("Enter your username.");
    const account = {
      platform: platform,
      username: typed,
      consentedAt: Date.now(),
      ownAccount: true
    };
    let games = [];
    try {
      if (platform === "lichess") games = await fetchLichess(typed);
      else if (platform === "chesscom") games = await fetchChessCom(typed);
      else if (platform === "pgn") games = parsePgnGames(opts.pgn || "");
      else throw new Error("Pick Lichess, Chess.com, or a PGN file.");
    } catch (e) {
      if (platform !== "pgn") {
        const err = e && e.message ? e.message : "Couldn’t download those games.";
        throw new Error(err.indexOf("PGN") >= 0 ? err : (err + " You can import a PGN file instead."));
      }
      throw e;
    }
    if (!games.length) throw new Error("No public games found. Try a PGN file.");
    if (!account.username) {
      const counts = {};
      const faces = {};
      games.forEach(function (g) {
        [g.white, g.black].forEach(function (n) {
          const k = safeName(n);
          if (k) {
            const key = k.toLowerCase();
            counts[key] = (counts[key] || 0) + 1;
            if (!faces[key]) faces[key] = k;
          }
        });
      });
      const top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      account.username = (top && faces[top]) || "";
    }
    if (window.SCDB.clear) {
      await window.SCDB.clear("games");
      await window.SCDB.clear("cards");
    }
    await window.SCDB.set("progress", "main", emptyProgress());
    await window.SCDB.set("meta", "account", account);
    await saveGames(games.slice(0, MAX_GAMES));
    status.running = false;
    status.done = 0;
    status.total = Math.min(games.length, MAX_GAMES);
    status.cards = 0;
    status.current = 0;
    notify();
    if (lastEngine) analyzeQueued(lastEngine);
    return { account, games: Math.min(games.length, MAX_GAMES) };
  }

  async function disconnectAndDelete() {
    await window.SCDB.wipe();
    status.running = false;
    status.done = 0;
    status.total = 0;
    status.cards = 0;
    notify();
  }

  async function exportAll() {
    return {
      version: 1,
      exportedAt: Date.now(),
      account: await getAccount(),
      games: await window.SCDB.all("games"),
      cards: await window.SCDB.all("cards"),
      progress: await getProgress()
    };
  }

  async function importAll(data) {
    if (!data || typeof data !== "object") throw new Error("That file isn’t a Sparring Coach backup.");
    if (data.account) await window.SCDB.set("meta", "account", data.account);
    for (let i = 0; i < (data.games || []).length; i++) await window.SCDB.set("games", data.games[i].id, data.games[i]);
    for (let i = 0; i < (data.cards || []).length; i++) await window.SCDB.set("cards", data.cards[i].id, data.cards[i]);
    if (data.progress) await window.SCDB.set("progress", "main", data.progress);
    notify();
  }

  async function markTodayDone() {
    const p = await getProgress();
    const day = todayKey();
    if (p.todayDate !== day) {
      p.todayDone = 0;
      p.todayDate = day;
    }
    p.todayDone = (p.todayDone || 0) + 1;
    p.thinkDone = (p.thinkDone || 0) + 1;
    if (p.lastStreakDay !== day) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yesterday = todayKey(y);
      p.streak = p.lastStreakDay === yesterday ? (p.streak || 0) + 1 : 1;
      p.lastStreakDay = day;
    }
    await setProgress(p);
    return p;
  }

  window.SCAccount = {
    getAccount, getProgress, setProgress, weakSpots, spotLabel, connect, disconnectAndDelete,
    exportAll, importAll, analyzeQueued, pauseAnalysis, resumeAnalysis, analysisStatus,
    parsePgnGames, onChange, personaFor, openingStats, markTodayDone, todayKey, MAX_GAMES
  };
})();
