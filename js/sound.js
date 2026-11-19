/* Optional move sounds and short spoken tips. Off by default. */
(function () {
  const Sound = {
    on: false,
    voice: false,
    _ctx: null,

    load() {
      try {
        const raw = localStorage.getItem("sc.sound");
        if (raw) {
          const o = JSON.parse(raw);
          this.on = !!o.on;
          this.voice = !!o.voice;
        }
      } catch (e) {}
    },

    save() {
      try { localStorage.setItem("sc.sound", JSON.stringify({ on: this.on, voice: this.voice })); } catch (e) {}
    },

    toggle() {
      this.on = !this.on;
      if (!this.on) this.voice = false;
      this.save();
      return this.on;
    },

    toggleVoice() {
      this.voice = !this.voice;
      if (this.voice) this.on = true;
      this.save();
      return this.voice;
    },

    _audio() {
      if (!this._ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this._ctx = new AC();
      }
      if (this._ctx.state === "suspended") this._ctx.resume();
      return this._ctx;
    },

    _tap(ms) {
      try {
        if (!this.on || !navigator.vibrate) return;
        navigator.vibrate(ms || 12);
      } catch (e) {}
    },

    _beep(freq, dur, type, gain) {
      if (!this.on) return;
      const ctx = this._audio();
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.value = gain || 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur);
    },

    // 1.6.2: when Feel is loaded these route to its samples and the native haptics bridge.
    move() { if (window.Feel) { window.Feel.sound("move"); window.Feel.haptic("move"); return; } this._beep(520, 0.08, "triangle", 0.04); this._tap(10); },
    good() { if (window.Feel) { window.Feel.sound("good"); window.Feel.haptic("good"); return; } this._beep(660, 0.1, "sine", 0.05); setTimeout(() => this._beep(880, 0.12, "sine", 0.04), 80); this._tap(16); },
    warn() { if (window.Feel) { window.Feel.sound("miss"); window.Feel.haptic("mistake"); return; } this._beep(240, 0.16, "square", 0.04); this._tap([8, 30, 12]); },
    capture() { if (window.Feel) { window.Feel.sound("capture"); window.Feel.haptic("capture"); return; } this._beep(200, 0.12, "sawtooth", 0.035); this._tap(18); },

    speak(text) {
      if (!this.on || !this.voice || !text || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(String(text).replace(/\s+/g, " ").slice(0, 220));
        u.rate = 1.02;
        u.pitch = 0.95;
        u.volume = 0.85;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
  };
  Sound.load();
  window.Sound = Sound;
})();
