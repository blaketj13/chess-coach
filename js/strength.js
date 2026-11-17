/* Bot strength by rating (estimates, not measured against rated humans).
   Under 1500: Stockfish MultiPV with softmax sampling whose temperature falls with rating,
   plus occasional *plausible* misses (a natural move within a bounded eval drop). Never a random blunder.
   1500-2500: UCI_LimitStrength + UCI_Elo, MultiPV 2 with a tight temperature, more time per move.
   Above 2500: full strength. Movetime is capped adaptively on slower phones.
   Maia is a separate, later milestone; engineMode() reports what drives each band. */
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const slow = (() => { try { return (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 3; } catch (e) { return false; } })();
  let speed = slow ? 0.7 : 1; // refined by calibrate()

  function strength(rating) {
    const r = clamp(Math.round(rating || 1000), 100, 2700);
    let s;
    if (r < 1500) {
      s = { elo: r, limit: false, skill: null, depth: Math.round(3 + (r - 100) / 140), movetime: Math.round(120 + (r - 100) / 1400 * 180),
        multipv: r < 800 ? 6 : r < 1200 ? 5 : 4, temperature: Math.round(300 * Math.exp(-(r - 100) / 600)),
        missRate: +(0.3 * Math.exp(-(r - 100) / 500)).toFixed(3), maxDrop: Math.round(400 * Math.exp(-(r - 100) / 700) + 60) };
    } else if (r <= 2500) {
      s = { elo: r, limit: true, skill: null, depth: null, movetime: Math.round(250 + (r - 1500) * 0.5),
        multipv: 2, temperature: Math.round(18 - (r - 1500) / 100), missRate: 0, maxDrop: Math.round(60 - (r - 1500) / 25) };
    } else {
      s = { elo: r, limit: false, skill: 20, depth: null, movetime: 800, multipv: 1, temperature: 0, missRate: 0, maxDrop: 0, full: true };
    }
    s.movetime = Math.round(clamp(s.movetime * speed, 100, slow ? 600 : 800));
    s.mode = engineMode(r).mode;
    s.label = "About " + (Math.round(r / 50) * 50) + " (estimate)";
    return s;
  }
  function engineMode(rating) {
    const r = Math.round(rating || 1000);
    const maia = window.MaiaEngine && window.MaiaEngine.available && window.MaiaEngine.available();
    if (maia) return window.MaiaEngine.modeFor(r);
    return { mode: "stockfish-sampled", rating: r, engine: "Stockfish 19.0.1 lite (single-thread WASM)", model: null, note: r < 1500 ? "MultiPV sampling, temperature by rating" : r <= 2500 ? "UCI_Elo limit + tight sampling" : "full strength" };
  }
  const bossElo = (r) => clamp(Math.round(r + 100), 300, 2700);
  const rivalElo = (r, rematch) => clamp(Math.round(r + 50 + (rematch || 0) * 150), 250, 2700);

  function scoreOf(pv) { return pv.isMate ? (pv.score > 0 ? 100000 - pv.score * 100 : -100000 - pv.score * 100) : pv.score; }
  function natural(chess, uci) {
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || "q" });
      if (!m) return false;
      chess.undo();
      return !!(m.captured || m.san.includes("+") || /[cdef][3-6]/.test(m.to) || m.flags.includes("k") || m.flags.includes("q"));
    } catch (e) { return false; }
  }
  /** Choose a bot move at a given rating. engine: StockfishEngine. Returns uci. */
  async function pick(engine, fen, rating) {
    const s = strength(rating);
    await engine.setStrength(s.limit ? s.elo : null, 20); // skill 20 resets any persona skill; UCI_Elo governs when limited
    const res = await engine.analyze(fen, { depth: s.depth || undefined, movetime: s.movetime, multipv: s.multipv });
    const pvs = (res.pvs || []).filter((p) => p.pv && p.pv[0]);
    if (!pvs.length) return res.bestmove;
    if (s.temperature <= 0 || pvs.length === 1) return pvs[0].pv[0];
    const best = scoreOf(pvs[0]);
    const pool = pvs.filter((p) => best - scoreOf(p) <= s.maxDrop || p === pvs[0]);
    if (best > 50000) return pvs[0].pv[0]; // never miss a forced mate it found
    const chess = new Chess(fen);
    if (s.missRate && Math.random() < s.missRate) {
      const human = pool.slice(1).filter((p) => natural(chess, p.pv[0]));
      if (human.length) return human[Math.floor(Math.random() * human.length)].pv[0];
    }
    const w = pool.map((p) => Math.exp((scoreOf(p) - best) / s.temperature));
    let t = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { t -= w[i]; if (t <= 0) return pool[i].pv[0]; }
    return pool[0].pv[0];
  }
  /** Measure this device once and scale movetimes (keeps low-end phones smooth). */
  async function calibrate(engine) {
    try {
      const t0 = performance.now();
      await engine.analyze("r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", { depth: 10, multipv: 1 });
      const ms = performance.now() - t0;
      speed = clamp(400 / Math.max(ms, 100), 0.5, 1);
      return { ms, speed };
    } catch (e) { return null; }
  }
  window.Strength = { strength, engineMode, bossElo, rivalElo, pick, calibrate, get speed() { return speed; } };
})();
