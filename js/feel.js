/* Game feel: synthesized sounds (WebAudio, no samples to license), eased motion, understated celebrations.
   Mute and reduced-motion live in Settings. No guilt, no loss-aversion pop-ups: the streak is a quiet record. */
(function () {
  const KEY = "sc.feel";
  const st = (() => { try { return Object.assign({ muted: false, reduced: null }, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return { muted: false, reduced: null }; } })();
  const sysReduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} syncSound(); apply(); };
  function syncSound() { if (window.Sound) { window.Sound.on = !st.muted; try { window.Sound.save(); } catch (e) {} } }
  function reducedMotion() { return st.reduced == null ? sysReduced() : !!st.reduced; }
  function apply() {
    const r = reducedMotion();
    document.documentElement.classList.toggle("reduced-motion", r);
    document.documentElement.setAttribute("data-reduced-motion", r ? "on" : "off");
    document.querySelectorAll("[data-testid=mute]").forEach((b) => { b.setAttribute("aria-pressed", st.muted ? "true" : "false"); b.textContent = st.muted ? "Sound: off" : "Sound: on"; });
    document.querySelectorAll("[data-testid=reduced-motion]").forEach((b) => { b.setAttribute("aria-pressed", r ? "true" : "false"); b.textContent = r ? "Reduced motion: on" : "Reduced motion: off"; });
  }

  // ---- sound ----------------------------------------------------------------------
  let ctx = null;
  function ac() {
    if (st.muted) return null;
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { ctx = new AC(); } catch (e) { return null; } }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(f, t0, dur, type, gain, f2) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, c.currentTime + t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, c.currentTime + t0 + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.05, c.currentTime + t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
    o.connect(g).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.02);
  }
  function knock(t0, pitch, gain) {
    const c = ac(); if (!c) return;
    const n = Math.floor(c.sampleRate * 0.05), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
    const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; bp.type = "bandpass"; bp.frequency.value = pitch || 900; bp.Q.value = 3; g.gain.value = gain || 0.5;
    src.connect(bp).connect(g).connect(c.destination); src.start(c.currentTime + t0);
    tone((pitch || 900) / 6, t0, 0.07, "sine", 0.04);
  }
  const SFX = {
    move: () => knock(0, 950, 0.45),
    capture: () => { knock(0, 700, 0.55); knock(0.045, 1100, 0.35); },
    check: () => { knock(0, 950, 0.4); tone(740, 0.03, 0.12, "triangle", 0.035); },
    good: () => { tone(659, 0, 0.12, "sine", 0.045); tone(988, 0.07, 0.18, "sine", 0.04); },
    ok: () => tone(587, 0, 0.14, "sine", 0.035),
    miss: () => tone(220, 0, 0.18, "sine", 0.05, 160),
    tap: () => tone(1200, 0, 0.03, "sine", 0.02),
    level: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.22, "triangle", 0.035)),
    boss: () => { [392, 494, 587, 784].forEach((f, i) => tone(f, i * 0.09, 0.4, "sine", 0.035)); tone(196, 0, 0.6, "sine", 0.03); },
    badge: () => { tone(880, 0, 0.12, "sine", 0.04); tone(1320, 0.09, 0.25, "sine", 0.035); }
  };
  function sound(name) { if (st.muted) return; try { (SFX[name] || SFX.tap)(); } catch (e) {} }

  // ---- motion -------------------------------------------------------------------------
  function sqEl(sq) { return document.querySelector('#lesson-board [data-sq="' + sq + '"], #board [data-sq="' + sq + '"], #rush-board [data-sq="' + sq + '"]'); }
  function flash(sq, cls, ms) { if (reducedMotion()) return; requestAnimationFrame(() => { const e = sqEl(sq); if (!e) return; e.classList.add(cls); setTimeout(() => e.classList.remove(cls), ms || 500); }); }
  function moved(m, chess) {
    if (!m) return;
    let mate = false, check = false;
    try { mate = !!(chess && chess.in_checkmate && chess.in_checkmate()); } catch (e) {}
    try { check = !!(chess && chess.in_check && chess.in_check()); } catch (e) {}
    sound(m.captured ? "capture" : check ? "check" : "move");
    if (m.captured) setTimeout(() => flash(m.to, "fx-pop", 380), 160);
    if (check) {
      const b = chess.board(); let k = null;
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const p = b[r][f]; if (p && p.type === "k" && p.color === chess.turn()) k = "abcdefgh"[f] + (8 - r); }
      if (k) setTimeout(() => flash(k, mate ? "fx-mate" : "fx-check", mate ? 900 : 650), 180);
    }
  }
  let particles = 0;
  function burst() {
    if (reducedMotion()) return false;
    const c = document.createElement("canvas");
    c.className = "particles"; c.width = innerWidth; c.height = innerHeight;
    document.body.appendChild(c);
    const x = c.getContext("2d"), N = 26, ps = [];
    for (let i = 0; i < N; i++) ps.push({ x: innerWidth / 2, y: innerHeight * 0.38, vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 6 - 2, life: 1 });
    particles++;
    let t0 = performance.now();
    (function frame(t) {
      const dt = Math.min(32, t - t0) / 16; t0 = t;
      x.clearRect(0, 0, c.width, c.height);
      let alive = 0;
      for (const p of ps) { p.vy += 0.22 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.018 * dt; if (p.life > 0) { alive++; x.globalAlpha = p.life; x.fillStyle = "#d9a441"; x.fillRect(p.x, p.y, 3, 3); } }
      if (alive && !reducedMotion()) requestAnimationFrame(frame); else { c.remove(); particles--; }
    })(t0);
    return true;
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
    ov.innerHTML = `<div class="ov-card cel" ${TIDS[id]}><div class="cel-mark">${id === "boss-complete" ? "♛" : id === "badge-unlock" ? "◆" : id === "level-up" ? "▲" : "✦"}</div><h2>${title}</h2><p class="coach-msg">${line}</p><button type="button" class="primary" id="cel-ok">${id === "rush-end" ? "Done" : "Continue"}</button></div>`;
    document.body.appendChild(ov);
    ov.querySelector("#cel-ok").addEventListener("click", () => ov.remove());
    sound(id === "boss-complete" ? "boss" : id === "level-up" ? "level" : id === "badge-unlock" ? "badge" : "good");
    if (id === "boss-complete" || id === "level-up") burst();
    return true;
  }
  function celebrate(kind, levelUp) {
    if (kind === "boss") { sound("boss"); burst(); }
    else if (kind === "lesson") sound("good");
    // Level-ups land inline on the complete screen (sound + sparks), never as a modal in the way of the next move.
    if (levelUp) setTimeout(() => { sound("level"); burst(); }, 350);
  }

  // ---- streak ring (quiet record) -----------------------------------------------------------
  function streakRing() {
    const P = window.Progress, d = P.dailyProgress(), s = P.get().streak;
    const pct = Math.min(1, d.minutes / Math.max(1, d.goal)), R = 26, C = 2 * Math.PI * R;
    return `<div class="streak" data-testid="streak-ring" title="Daily goal">
      <svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="${R}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="6"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="#d9a441" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="15" fill="#e8eef2">${d.minutes}</text></svg>
      <div class="streak-txt"><b>${d.minutes} of ${d.goal} min</b><span class="muted">${s.days ? s.days + "-day streak · best " + s.best : "Streak starts with today's first move"}</span></div></div>`;
  }

  const api = {
    sound, sfx: sound, moved, burst, celebrate, show, trigger: show, streakRing,
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
