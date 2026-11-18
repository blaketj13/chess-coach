/* Content packs: signed, DATA-ONLY JSON (weekly puzzles, a rival or region slice, seasonal events).
   Trust chain: Ed25519 signature over the exact payload bytes, checked against a public key bundled in the app
   (js/pack-key.js) -> strict schema whitelist -> version (no rollback) -> expiry -> every FEN and line legal.
   Packs never carry code: nothing in them is evaluated, injected as HTML, or used as a URL.
   Positions were engine-verified when the pack was built; the client re-checks each one lazily with Stockfish
   the first time it is played, and drops any that fail. */
(function () {
  const STORE = "sc.packs.v1";
  const BUNDLED = ["data/packs/weekly-sample.json"];
  const KINDS = ["weekly-puzzles", "rival", "region", "seasonal"];
  const MAX_BYTES = 256 * 1024, MAX_ITEMS = 60;
  const state = (() => { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return {}; } })();
  state.packs = state.packs || {}; state.checks = state.checks || {};
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} };
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const APP = () => (window.APP_VERSION || "1.6.1");
  const cmpVer = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

  async function verifySig(pubB64, payload, sigB64) {
    const data = new TextEncoder().encode(payload), sig = b64(sigB64), pub = b64(pubB64);
    try {
      const key = await crypto.subtle.importKey("raw", pub, { name: "Ed25519" }, false, ["verify"]);
      return await crypto.subtle.verify({ name: "Ed25519" }, key, sig, data);
    } catch (e) {
      // Older WebViews: vendored @noble/ed25519 (MIT), pure JS.
      const ed = await import(new URL("vendor/noble-ed25519.mjs", document.baseURI).href);
      return await ed.verifyAsync(sig, data, pub);
    }
  }

  const isStr = (v, max) => typeof v === "string" && v.length <= max;
  const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
  function schema(p) {
    const err = (m) => { throw new Error("pack schema: " + m); };
    const allowed = ["format", "id", "version", "kind", "title", "blurb", "issued", "expires", "minApp", "tier", "credit", "verified", "items"];
    if (!p || typeof p !== "object" || Array.isArray(p)) err("not an object");
    Object.keys(p).forEach((k) => { if (!allowed.includes(k)) err("unknown field " + k); });
    if (p.format !== "sc-pack/1") err("format");
    if (!/^[a-z0-9-]{3,40}$/.test(p.id || "")) err("id");
    if (!Number.isInteger(p.version) || p.version < 1) err("version");
    if (!KINDS.includes(p.kind)) err("kind");
    if (!isStr(p.title, 60) || !isStr(p.blurb || "", 140) || !isStr(p.credit || "", 200)) err("text");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.issued || "")) err("issued");
    if (p.expires != null && !/^\d{4}-\d{2}-\d{2}$/.test(p.expires)) err("expires");
    if (!["free", "pro"].includes(p.tier)) err("tier");
    if (!Array.isArray(p.items) || !p.items.length || p.items.length > MAX_ITEMS) err("items");
    const itemKeys = ["fen", "line", "accept", "san", "eval", "rating", "themes", "p"];
    p.items.forEach((it, i) => {
      Object.keys(it).forEach((k) => { if (!itemKeys.includes(k)) err(`item ${i} field ${k}`); });
      if (!isStr(it.fen, 100) || !isStr(it.p, 140) || !isStr(it.san || "", 10)) err(`item ${i} text`);
      if (!Array.isArray(it.line) || !it.line.length || it.line.length > 5 || !it.line.every((u) => UCI.test(u))) err(`item ${i} line`);
      if (!Array.isArray(it.accept) || !it.accept.length || it.accept.length > 3 || !it.accept.every((u) => UCI.test(u))) err(`item ${i} accept`);
      if (!Number.isInteger(it.rating) || it.rating < 0 || it.rating > 3500) err(`item ${i} rating`);
      if (!Array.isArray(it.themes) || !it.themes.every((t) => isStr(t, 40))) err(`item ${i} themes`);
      // Legal position and line (chess.js), so a bad pack can't hang the board.
      const c = new Chess(it.fen);
      if (c.fen().split(" ")[0] !== it.fen.split(" ")[0]) err(`item ${i} fen`);
      for (const u of it.line) if (!c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] })) err(`item ${i} illegal line`);
    });
  }

  /** Verify an envelope and install it. Returns {ok, pack|reason}. Nothing from the pack is ever executed. */
  async function install(env, opts) {
    try {
      if (!env || env.format !== "sc-pack-envelope/1" || typeof env.payload !== "string" || typeof env.sig !== "string") throw new Error("envelope");
      if (env.payload.length > MAX_BYTES) throw new Error("too large");
      const keys = window.SC_PACK_KEYS || {};
      const pub = keys[env.keyId];
      if (!pub) throw new Error("unknown signing key");
      if (!(await verifySig(pub, env.payload, env.sig))) throw new Error("bad signature");
      const p = JSON.parse(env.payload);
      schema(p);
      if (cmpVer(APP(), p.minApp || "0") < 0) throw new Error("needs app " + p.minApp);
      const today = (opts && opts.today) || new Date().toISOString().slice(0, 10);
      if (p.expires && p.expires < today) throw new Error("expired " + p.expires);
      const have = state.packs[p.id];
      if (have && have.version > p.version) throw new Error("older than installed (v" + have.version + ")");
      state.packs[p.id] = p; save();
      register(p);
      return { ok: true, pack: p };
    } catch (e) { return { ok: false, reason: String(e.message || e) }; }
  }
  async function loadBundled() {
    const out = [];
    for (const url of BUNDLED) {
      try { out.push(await install(await (await fetch(url)).json())); } catch (e) { out.push({ ok: false, reason: "fetch " + url }); }
    }
    // Re-register stored packs that are still valid (expired ones drop out).
    const today = new Date().toISOString().slice(0, 10);
    Object.values(state.packs).forEach((p) => { if (!p.expires || p.expires >= today) register(p); });
    return out;
  }
  const lessonId = (p) => "pack-" + p.id;
  function register(p) {
    if (!window.Lessons || !window.Lessons.register) return;
    const bad = state.checks[p.id + "@" + p.version] || {};
    window.Lessons.register({
      id: lessonId(p), unit: null, title: p.title, pack: p.id, tier: 0,
      stages: p.items.map((it, i) => ({ k: i === p.items.length - 1 ? "boss" : "practice", fen: it.fen, side: it.fen.split(" ")[1], p: it.p, line: it.line, accept: it.accept, san: it.san, rating: it.rating, packItem: i, r: it.themes.length ? "Theme: " + it.themes.slice(0, 2).join(", ") + "." : "" })).filter((s, i) => !bad[i])
    });
  }
  /** Lazy client re-check: the first time an item is played, Stockfish confirms its answer still holds. */
  async function recheck(packId, i, engine) {
    const p = state.packs[packId]; if (!p || !engine) return true;
    const key = p.id + "@" + p.version; state.checks[key] = state.checks[key] || {};
    if (state.checks[key][i] != null) return state.checks[key][i] !== false;
    const it = p.items[i];
    try {
      const r = await engine.analyze(it.fen, { depth: 12, multipv: 2 });
      const best = r.pvs && r.pvs[0] && r.pvs[0].pv[0];
      const ok = !best || it.accept.includes(best) || (r.pvs[1] && it.accept.includes(r.pvs[1].pv[0]) && Math.abs(r.pvs[0].score - r.pvs[1].score) <= 60);
      state.checks[key][i] = ok ? true : false; save();
      return ok;
    } catch (e) { return true; }
  }
  function list() { return Object.values(state.packs).map((p) => ({ id: p.id, version: p.version, kind: p.kind, title: p.title, blurb: p.blurb, tier: p.tier, items: p.items.length, expires: p.expires, lesson: lessonId(p) })); }
  function start(id) { const p = state.packs[id]; if (p && window.Lessons) return window.Lessons.start(lessonId(p), { from: "train" }); return false; }
  window.Packs = { install, loadBundled, list, start, recheck, schema, verifySig };
  window.__qa = window.__qa || {};
  window.__qa.packs = window.Packs;
})();
