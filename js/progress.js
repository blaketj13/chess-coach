/* Shared progress for both tracks (Adventure and Train): one rating, XP, streak, badges,
   lesson results and journey history. Stored on the device only (localStorage). */
(function () {
  const KEY = "sc.progress.v1";
  const RMIN = 100, RMAX = 2600;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const dayDiff = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 86400000);

  function blank() {
    return {
      character: null,
      placement: { status: "none", games: [] }, // none | later | new | done
      rating: { estimate: 1050, rd: 350, vol: 0.06, games: 0, history: [] },
      xp: 0, combo: 0,
      lessons: {},        // id -> { done, score, stars, at, tries }
      nodes: {},          // journey node id -> { complete, at }
      testedOut: {},      // unit -> true (skill check)
      bosses: [],         // { id, at, rating, score }
      rivals: {},         // rival id -> { wins, losses, draws, best }
      badges: {},         // id -> at
      misses: [],         // lesson misses (fen, uci, at) -> FSRS cards
      retired: 0,
      streak: { days: 0, best: 0, last: null },
      daily: { goal: 10, date: null, minutes: 0 },
      rush: { best: 0, runs: 0 },
      firstSeen: Date.now(),
      next: null
    };
  }
  let S = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) return Object.assign(blank(), s); } catch (e) {}
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} emit(); }
  const subs = [];
  function emit() { subs.forEach((f) => { try { f(S); } catch (e) {} }); }

  // ---- Glicko-2 -------------------------------------------------------------
  const TAU = 0.5, SCALE = 173.7178;
  function g(phi) { return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI)); }
  function E(mu, muj, phij) { return 1 / (1 + Math.exp(-g(phij) * (mu - muj))); }
  /** One rating period with a list of { rating, rd, score } results. */
  function glicko(r, results) {
    let mu = (r.estimate - 1500) / SCALE, phi = r.rd / SCALE, sigma = r.vol || 0.06;
    if (!results.length) return r;
    let v = 0, d = 0;
    for (const o of results) {
      const muj = (o.rating - 1500) / SCALE, phij = (o.rd || 60) / SCALE, e = E(mu, muj, phij), gg = g(phij);
      v += gg * gg * e * (1 - e); d += gg * (o.score - e);
    }
    v = 1 / v; const delta = v * d;
    const a = Math.log(sigma * sigma);
    const f = (x) => { const ex = Math.exp(x); return ex * (delta * delta - phi * phi - v - ex) / (2 * Math.pow(phi * phi + v + ex, 2)) - (x - a) / (TAU * TAU); };
    let A = a, B;
    if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
    else { let k = 1; while (f(a - k * TAU) < 0) k++; B = a - k * TAU; }
    let fA = f(A), fB = f(B);
    for (let i = 0; i < 60 && Math.abs(B - A) > 1e-6; i++) {
      const C = A + (A - B) * fA / (fB - fA), fC = f(C);
      if (fC * fB <= 0) { A = B; fA = fB; } else fA /= 2;
      B = C; fB = fC;
    }
    const sig = Math.exp(A / 2);
    const phiStar = Math.sqrt(phi * phi + sig * sig);
    const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
    const muNew = mu + phiNew * phiNew * d;
    return { estimate: clamp(Math.round(muNew * SCALE + 1500), RMIN, RMAX), rd: clamp(Math.round(phiNew * SCALE), 45, 350), vol: sig, games: r.games, history: r.history };
  }
  /** Record a rated result against an opponent of known (estimated) strength. source: placement|boss|rival|rush|spar */
  function rate(opponent, score, source, opts) {
    const r = glicko(S.rating, [{ rating: opponent, rd: (opts && opts.rd) || 60, score }]);
    r.games = (S.rating.games || 0) + 1;
    r.history = (S.rating.history || []).concat([{ at: Date.now(), estimate: r.estimate, rd: r.rd, source, opp: opponent, score }]).slice(-200);
    S.rating = r;
    save();
    return r;
  }
  function setRating(n, rd) {
    S.rating = Object.assign({}, S.rating, { estimate: clamp(Math.round(n), RMIN, RMAX), rd: rd || S.rating.rd || 200 });
    S.rating.history = (S.rating.history || []).concat([{ at: Date.now(), estimate: S.rating.estimate, rd: S.rating.rd, source: "seed" }]);
    save();
  }
  function band() { const r = S.rating; return { low: clamp(r.estimate - 2 * r.rd, RMIN, RMAX), high: clamp(r.estimate + 2 * r.rd, RMIN, RMAX) }; }
  function ratingLabel() {
    const r = S.rating;
    const settle = r.rd > 150 ? "still settling" : r.rd > 90 ? "settling" : "steady";
    return "About " + r.estimate + ", " + settle;
  }

  // ---- XP, levels, streak ----------------------------------------------------
  // Level n needs 100*n XP beyond the previous level (100, 200, 300 ...).
  function levelOf(xp) { let lvl = 1, need = 100, left = xp; while (left >= need) { left -= need; lvl++; need = 100 * lvl; } return { level: lvl, into: left, need }; }
  function addXp(base, opts) {
    const clean = opts && opts.noHint;
    S.combo = clean ? (S.combo || 0) + 1 : 0;
    const mult = clean ? Math.min(3, 1 + Math.floor(S.combo / 3) * 0.5) : 1;
    const gain = Math.round(base * mult);
    const before = levelOf(S.xp).level;
    S.xp += gain;
    const after = levelOf(S.xp).level;
    touchDay(0.5);
    save();
    return { gain, mult, combo: S.combo, levelUp: after > before ? after : null };
  }
  /** Quiet streak: counts days you trained. Missing a day just resets the count. No guilt copy. */
  function touchDay(minutes) {
    const t = today();
    if (S.streak.last !== t) {
      const gap = S.streak.last ? dayDiff(S.streak.last, t) : null;
      S.streak.days = gap === 1 ? S.streak.days + 1 : 1;
      S.streak.best = Math.max(S.streak.best, S.streak.days);
      S.streak.last = t;
    }
    if (S.daily.date !== t) { S.daily.date = t; S.daily.minutes = 0; }
    S.daily.minutes += minutes || 0;
  }
  function dailyProgress() { const t = today(); return { goal: S.daily.goal, minutes: S.daily.date === t ? Math.round(S.daily.minutes) : 0 }; }

  // ---- lessons, nodes, badges -------------------------------------------------
  function lessonDone(id, score, stars) {
    const prev = S.lessons[id] || { tries: 0 };
    S.lessons[id] = { done: score >= 0.8 || prev.done || false, score: Math.max(score, prev.score || 0), stars: Math.max(stars || 0, prev.stars || 0), at: Date.now(), tries: (prev.tries || 0) + 1 };
    save();
    return S.lessons[id];
  }
  function addMiss(m) { S.misses = S.misses.concat([Object.assign({ at: Date.now() }, m)]).slice(-300); save(); }
  function badge(id) { if (S.badges[id]) return false; S.badges[id] = Date.now(); save(); return true; }
  function setNext(next) { S.next = next; save(); }

  window.Progress = {
    get: () => S, save, load: () => (S = load()), reset() { S = blank(); save(); },
    on(f) { subs.push(f); },
    rate, setRating, band, ratingLabel, glicko,
    levelOf, addXp, touchDay, dailyProgress,
    lessonDone, addMiss, badge, setNext,
    RMIN, RMAX
  };
})();
