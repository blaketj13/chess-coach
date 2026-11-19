/* Game feel (1.6.2): CC0 wood and impact samples (Kenney, see licenses/KENNEY-CC0.txt) with a synthesized
   fallback, subtle native haptics through the Android bridge (no VIBRATE permission), eased motion and
   celebrations you can skip. Sound, haptics and reduced motion live in Settings; mute is also in the Play bar.
   No guilt, no loss-aversion pop-ups: the streak is a quiet record. */
(function () {
  const KEY = "sc.feel";
  const DEF = { muted: false, reduced: null, haptics: true };
  const st = (() => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return Object.assign({}, DEF); } })();
  const sysReduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} syncSound(); apply(); };
  function syncSound() { if (window.Sound) { window.Sound.on = !st.muted; try { window.Sound.save(); } catch (e) {} } }
  function reducedMotion() { return st.reduced == null ? sysReduced() : !!st.reduced; }
  function apply() {
    const r = reducedMotion();
    document.documentElement.classList.toggle("reduced-motion", r);
    document.documentElement.setAttribute("data-reduced-motion", r ? "on" : "off");
    document.querySelectorAll("[data-testid=mute]").forEach((b) => { b.setAttribute("aria-pressed", st.muted ? "true" : "false"); b.textContent = st.muted ? "Sound: off" : "Sound: on"; });
    document.querySelectorAll("[data-testid=play-mute]").forEach((b) => { b.setAttribute("aria-pressed", st.muted ? "true" : "false"); b.setAttribute("aria-label", st.muted ? "Sound off. Tap to turn on" : "Sound on. Tap to mute"); b.innerHTML = speakerSvg(st.muted); });
    document.querySelectorAll("[data-testid=haptics]").forEach((b) => { b.setAttribute("aria-pressed", st.haptics ? "true" : "false"); b.textContent = st.haptics ? "Haptics: on" : "Haptics: off"; });
    document.querySelectorAll("[data-testid=reduced-motion]").forEach((b) => { b.setAttribute("aria-pressed", r ? "true" : "false"); b.textContent = r ? "Reduced motion: on" : "Reduced motion: off"; });
  }
  function speakerSvg(muted) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' +
      (muted ? '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>') + "</svg>";
  }

  // ---- sound ----------------------------------------------------------------------
  // 12 short samples, each under 30 KB; every effect but win, level and boss is 400 ms or less.
  const SAMPLES = ["move", "capture", "check", "good", "ok", "miss", "tap", "combo", "level", "win", "badge", "boss"];
  const MASTER = 0.9;
  let ctx = null, master = null;
  const buf = {};
  let loading = false;
  function ac() {
    if (st.muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      try { ctx = new AC(); master = ctx.createGain(); master.gain.value = MASTER; master.connect(ctx.destination); } catch (e) { ctx = null; return null; }
      loadSamples();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  function loadSamples() {
    if (loading || !ctx || !window.fetch || location.protocol === "file:") return;
    loading = true;
    const base = new URL(".", document.baseURI || location.href);
    SAMPLES.forEach((n) => {
      fetch(new URL("vendor/sfx/" + n + ".ogg", base)).then((r) => r.ok ? r.arrayBuffer() : null).then((ab) => {
        if (!ab || !ctx) return;
        return new Promise((res) => { try { ctx.decodeAudioData(ab, (b) => { buf[n] = b; res(); }, () => res()); } catch (e) { res(); } });
      }).catch(() => {});
    });
  }
  function sample(name, rate, gain, t0) {
    const c = ac(); if (!c || !buf[name]) return false;
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf[name]; src.playbackRate.value = rate || 1; g.gain.value = gain == null ? 1 : gain;
    src.connect(g).connect(master); src.start(c.currentTime + (t0 || 0));
    return true;
  }
  function tone(f, t0, dur, type, gain, f2) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, c.currentTime + t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, c.currentTime + t0 + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.1, c.currentTime + t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
    o.connect(g).connect(master); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.02);
  }
  function knock(t0, pitch, gain) {
    const c = ac(); if (!c) return;
    const n = Math.floor(c.sampleRate * 0.05), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
    const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = b; bp.type = "bandpass"; bp.frequency.value = pitch || 900; bp.Q.value = 3; g.gain.value = gain || 0.9;
    src.connect(bp).connect(g).connect(master); src.start(c.currentTime + t0);
    tone((pitch || 900) / 6, t0, 0.07, "sine", 0.08);
  }
  // Synth fallback (first tap before samples decode, or no fetch). Louder than 1.6.1.
  const SYNTH = {
    move: () => knock(0, 950, 0.9),
    capture: () => { knock(0, 700, 1); knock(0.045, 1100, 0.6); },
    check: () => { knock(0, 950, 0.8); tone(740, 0.03, 0.12, "triangle", 0.07); },
    good: () => { tone(659, 0, 0.12, "sine", 0.09); tone(988, 0.07, 0.18, "sine", 0.08); },
    ok: () => tone(587, 0, 0.14, "sine", 0.07),
    miss: () => tone(220, 0, 0.18, "sine", 0.08, 160),
    tap: () => tone(1200, 0, 0.03, "sine", 0.04),
    combo: (r) => tone(660 * (r || 1), 0, 0.12, "triangle", 0.07),
    level: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.22, "triangle", 0.07)),
    win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.08, 0.3, "triangle", 0.07)),
    boss: () => { [392, 494, 587, 784].forEach((f, i) => tone(f, i * 0.09, 0.4, "sine", 0.07)); tone(196, 0, 0.6, "sine", 0.06); },
    badge: () => { tone(880, 0, 0.12, "sine", 0.08); tone(1320, 0.09, 0.25, "sine", 0.07); }
  };
  const GAIN = { move: 0.8, capture: 1, check: 0.9, good: 0.8, ok: 0.7, miss: 0.6, tap: 0.5, combo: 0.75, level: 0.9, win: 1, badge: 0.8, boss: 0.8 };
  function sound(name, opts) {
    if (st.muted) return;
    const rate = opts && opts.rate;
    try {
      if (!sample(name, rate, GAIN[name])) (SYNTH[name] || SYNTH.tap)(rate);
      if (name === "check") sample("ok", 1.5, 0.35, 0.03);
    } catch (e) {}
  }
  /** Rising pitch: +1 semitone per clean move, capped at 5. */
  function combo(n) { const k = Math.max(0, Math.min(5, (n || 1) - 1)); sound("combo", { rate: Math.pow(2, k / 12) }); }

  // ---- haptics ----------------------------------------------------------------------
  // Whitelisted kinds only. On Android: View.performHapticFeedback via the bridge (respects the phone's
  // touch-feedback setting). On the web: a very short vibrate where the browser allows it.
  const HAPTIC_KINDS = ["move", "capture", "check", "good", "win", "level", "mistake", "tap"];
  const WEB_MS = { move: 6, capture: 10, check: 10, good: [8, 40, 8], win: [10, 50, 14], level: [10, 50, 14], mistake: [14, 60, 14], tap: 5 };
  let lastHaptic = 0, lastKind = null;
  const hlog = [];
  function haptic(kind) {
    if (!st.haptics || HAPTIC_KINDS.indexOf(kind) < 0) return false;
    const now = Date.now();
    if (now - lastHaptic < 40 && kind === "move") return false;
    if (kind === lastKind && now - lastHaptic < 150) return false; // one buzz per event, never a double
    lastHaptic = now; lastKind = kind;
    hlog.push(kind); if (hlog.length > 50) hlog.shift();
    try {
      const b = window.SparringCoachAndroid;
      if (b && typeof b.haptic === "function") { b.haptic(kind); return true; }
      if (navigator.vibrate && !/wv\)/.test(navigator.userAgent || "")) navigator.vibrate(WEB_MS[kind] || 6);
    } catch (e) {}
    return true;
  }

  // ---- motion -------------------------------------------------------------------------
  // Everything here is skipped under reduced motion; sound and haptics still confirm the move.
  const BOARDS = "#lesson-board, #board, #rush-board, #pr-board, #calc-board, #clock-board";
  function sqEl(sq) {
    const roots = Array.from(document.querySelectorAll(BOARDS)).filter((r) => r.offsetParent !== null);
    for (const r of roots) { const e = r.querySelector('[data-sq="' + sq + '"]'); if (e) return e; }
    return null;
  }
  function flash(sq, cls, ms) { if (reducedMotion()) return; requestAnimationFrame(() => { const e = sqEl(sq); if (!e) return; e.classList.add(cls); setTimeout(() => e.classList.remove(cls), ms || 500); }); }
  function kingSq(chess) {
    const b = chess.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const p = b[r][f]; if (p && p.type === "k" && p.color === chess.turn()) return "abcdefgh"[f] + (8 - r); }
    return null;
  }
  let particles = 0;
  /** Shards: the captured piece breaks into 14 pieces in its own color. */
  function shards(sq, color) {
    if (reducedMotion()) return false;
    const e = sqEl(sq); if (!e) return false;
    const r = e.getBoundingClientRect();
    const c = document.createElement("canvas");
    c.className = "particles fx-shards"; c.width = innerWidth; c.height = innerHeight;
    document.body.appendChild(c);
    const x = c.getContext("2d"), cx = r.left + r.width / 2, cy = r.top + r.height / 2, ps = [];
    const fill = color === "w" ? "#fff6e0" : "#1d1838", edge = color === "w" ? "#c9b98f" : "#9f7dff";
    for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 4; ps.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, s: 3 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 1 }); }
    particles++;
    let t0 = performance.now();
    (function frame(t) {
      const dt = Math.min(32, t - t0) / 16; t0 = t;
      x.clearRect(0, 0, c.width, c.height);
      let alive = 0;
      for (const p of ps) {
        p.vy += 0.25 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= 0.035 * dt;
        if (p.life > 0) { alive++; x.save(); x.globalAlpha = p.life; x.translate(p.x, p.y); x.rotate(p.rot); x.fillStyle = fill; x.strokeStyle = edge; x.lineWidth = 1; x.beginPath(); x.moveTo(-p.s, -p.s / 2); x.lineTo(p.s, 0); x.lineTo(-p.s / 3, p.s); x.closePath(); x.fill(); x.stroke(); x.restore(); }
      }
      if (alive && !reducedMotion()) requestAnimationFrame(frame); else { c.remove(); particles--; }
    })(t0);
    return true;
  }
  /** 3 px board shake after a short hit-stop. */
  function shake(root) {
    if (reducedMotion()) return;
    const el = root || Array.from(document.querySelectorAll(BOARDS)).find((r) => r.offsetParent !== null);
    if (!el) return;
    setTimeout(() => { el.classList.remove("fx-shake"); void el.offsetWidth; el.classList.add("fx-shake"); setTimeout(() => el.classList.remove("fx-shake"), 260); }, 80);
  }
  /** Mate: the board dims for a beat and gold rays come up behind the king. */
  function mateMoment(sq) {
    if (reducedMotion()) return false;
    const e = sqEl(sq); if (!e) return false;
    const host = e.closest(".cb-sizer"); if (!host) return false;
    const fx = document.createElement("div");
    fx.className = "fx-mate-dim";
    const c = document.createElement("div");
    c.className = "fx-rays";
    const r = e.getBoundingClientRect(), hr = host.getBoundingClientRect();
    c.style.left = ((r.left + r.width / 2 - hr.left) / hr.width * 100) + "%";
    c.style.top = ((r.top + r.height / 2 - hr.top) / hr.height * 100) + "%";
    fx.appendChild(c);
    host.appendChild(fx);
    setTimeout(() => fx.remove(), 1400);
    return true;
  }
  function moved(m, chess, opts) {
    if (!m) return;
    let mate = false, check = false;
    try { mate = !!(chess && chess.in_checkmate && chess.in_checkmate()); } catch (e) {}
    try { check = !!(chess && chess.in_check && chess.in_check()); } catch (e) {}
    sound(m.captured ? "capture" : check ? "check" : "move");
    haptic(m.captured ? "capture" : check ? "check" : "move");
    if (m.captured) {
      const victim = m.color === "w" ? "b" : "w";
      setTimeout(() => { flash(m.to, "fx-pop", 380); shards(m.to, victim); }, 150);
      if (m.captured === "q" || m.captured === "r") shake();
    }
    if (check) {
      const k = kingSq(chess);
      if (k) setTimeout(() => {
        flash(k, mate ? "fx-mate" : "fx-check", mate ? 1200 : 900);
        if (mate) { mateMoment(k); shake(); }
      }, 180);
    }
  }
  function burst(opts) {
    if (reducedMotion()) return false;
    const c = document.createElement("canvas");
    c.className = "particles"; c.width = innerWidth; c.height = innerHeight;
    document.body.appendChild(c);
    const COLORS = ["#ffc145", "#ff8a3d", "#3fe3b2", "#9f7dff", "#7fb2ff", "#fff6e0"];
    const x = c.getContext("2d"), N = (opts && opts.n) || 70, ps = [];
    for (let i = 0; i < N; i++) ps.push({ x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.3, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 9 - 3, w: 4 + Math.random() * 5, h: 7 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, col: COLORS[i % COLORS.length], life: 1 });
    particles++;
    let t0 = performance.now();
    (function frame(t) {
      const dt = Math.min(32, t - t0) / 16; t0 = t;
      x.clearRect(0, 0, c.width, c.height);
      let alive = 0;
      for (const p of ps) {
        p.vy += 0.2 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= 0.011 * dt;
        if (p.life > 0 && p.y < innerHeight + 20) { alive++; x.save(); x.globalAlpha = Math.min(1, p.life * 1.5); x.translate(p.x, p.y); x.rotate(p.rot); x.fillStyle = p.col; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore(); }
      }
      if (alive && !reducedMotion()) requestAnimationFrame(frame); else { c.remove(); particles--; }
    })(t0);
    return true;
  }
  /** Numbers count up (ease-out). Under reduced motion they just appear. */
  function countUp(el, to, opts) {
    if (!el) return;
    const from = (opts && opts.from) || 0, ms = (opts && opts.ms) || 900, pre = (opts && opts.prefix) || "", post = (opts && opts.suffix) || "";
    if (reducedMotion() || ms <= 0) { el.textContent = pre + to + post; return; }
    const t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + Math.round(from + (to - from) * e) + post;
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    })(t0);
  }

  // ---- celebrations ---------------------------------------------------------------------
  const CEL = {
    "xp-gain": () => ["+20 XP", "Clean solves build a combo. Three in a row adds a multiplier."],
    "level-up": (lv) => ["Level " + (lv || window.Progress.levelOf(window.Progress.get().xp).level), "New level. Same coach, sharper player."],
    "boss-complete": () => ["Boss down", "That region's test is cleared. The next one scales to your rating."],
    "badge-unlock": (b) => { const d = window.Badges && Object.values(window.Badges.DEFS).find((x) => x.name === b); return [b || "Badge earned", d ? d.line + " Earned on the board, not in a menu." : "Earned from something you actually did on the board."]; },
    "rush-end": (s) => [(s != null ? s : window.Progress.get().rush.best) + " solved", "Rush is over. Your best stays on record."]
  };
  function show(id, arg) {
    if (id === "streak-ring") { const h = document.querySelector("[data-testid=streak-ring]"); if (h) { h.scrollIntoView && h.scrollIntoView({ block: "center" }); return true; } if (window.UI) window.UI.showTab("today"); return true; }
    if (id === "rush-start") { if (window.Rush) window.Rush.open(); return true; }
    if (!CEL[id]) return false;
    const [title, line] = CEL[id](arg);
    document.querySelectorAll(".overlay.feel-ov").forEach((x) => x.remove());
    const ov = document.createElement("div");
    ov.className = "overlay feel-ov";
    const TIDS = { "xp-gain": 'data-testid="xp-gain"', "level-up": 'data-testid="level-up"', "boss-complete": 'data-testid="boss-complete"', "badge-unlock": 'data-testid="badge-unlock"', "rush-end": 'data-testid="rush-end"' };
    ov.innerHTML = `<div class="ov-card cel" ${TIDS[id]}><div class="cel-mark">${id === "boss-complete" ? "♛" : id === "badge-unlock" ? "◆" : id === "level-up" ? "▲" : "✦"}</div><h2 class="display">${title}</h2><p class="coach-msg">${line}</p><button type="button" class="primary" id="cel-ok">${id === "rush-end" ? "Done" : "Continue"}</button></div>`;
    document.body.appendChild(ov);
    ov.querySelector("#cel-ok").addEventListener("click", () => ov.remove());
    sound(id === "boss-complete" ? "boss" : id === "level-up" ? "level" : id === "badge-unlock" ? "badge" : "good");
    haptic(id === "level-up" || id === "boss-complete" ? "level" : "good");
    if (id === "boss-complete" || id === "level-up") burst();
    return true;
  }
  function celebrate(kind, levelUp) {
    if (kind === "boss") { sound("boss"); haptic("level"); burst(); }
    else if (kind === "win") { sound("win"); haptic("win"); burst({ n: 90 }); }
    else if (kind === "lesson") { sound("good"); haptic("good"); }
    // Level-ups land inline on the complete screen (sound + sparks), never as a modal in the way of the next move.
    if (levelUp) setTimeout(() => { sound("level"); haptic("level"); burst(); }, 350);
  }

  // ---- streak ring (quiet record) -----------------------------------------------------------
  function streakRing() {
    const P = window.Progress, d = P.dailyProgress(), s = P.get().streak;
    const pct = Math.min(1, d.minutes / Math.max(1, d.goal)), R = 26, C = 2 * Math.PI * R;
    return `<div class="streak" data-testid="streak-ring" title="Daily goal">
      <svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="${R}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="6"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="#ffc145" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="15" fill="#f4f0ff">${d.minutes}</text></svg>
      <div class="streak-txt"><b>${d.minutes} of ${d.goal} min</b><span class="muted">${s.days ? s.days + "-day streak · best " + s.best : "Streak starts with today's first move"}</span></div></div>`;
  }

  const api = {
    sound, sfx: sound, combo, moved, burst, shards, shake, mateMoment, countUp, celebrate, show, trigger: show, streakRing,
    haptic, hapticsOn: () => !!st.haptics, setHaptics(v) { st.haptics = !!v; save(); }, toggleHaptics() { st.haptics = !st.haptics; save(); return st.haptics; },
    hapticLog: () => hlog.slice(), HAPTIC_KINDS: HAPTIC_KINDS.slice(), SAMPLES: SAMPLES.slice(), samplesLoaded: () => Object.keys(buf),
    muted: () => !!st.muted, setMuted(v) { st.muted = !!v; save(); }, toggleMute() { st.muted = !st.muted; save(); return st.muted; },
    playSample() { sound("move"); },
    reducedMotion, setReducedMotion(v) { st.reduced = !!v; save(); }, toggleReducedMotion() { st.reduced = !reducedMotion(); save(); return st.reduced; },
    particlesActive: () => particles > 0, apply
  };
  window.Feel = api;
  window.__qa = window.__qa || {};
  window.__qa.feel = api;
  document.addEventListener("DOMContentLoaded", () => { syncSound(); apply(); });
})();
