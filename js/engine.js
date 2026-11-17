/* Loads the unmodified Stockfish.js 19.0.1 lite-single engine from engine/stockfish/
   as a Web Worker and talks to it only over UCI. Do not bundle or patch those files. */
(function () {
  class StockfishEngine {
    constructor() {
      this.worker = null;
      this.queue = [];
      this.handlers = [];
      this.ready = false;
      this._readyPromise = null;
      this._waiting = null;
      this._queue = Promise.resolve();
      this._strength = { elo: null, skill: null, coaching: false };
      this.options = { hasElo: false, hasSkill: false, hasLimit: false };
    }

    start() {
      if (this._readyPromise) return this._readyPromise;
      this._readyPromise = new Promise((resolve, reject) => {
        try {
          const workerUrl = new URL("engine/stockfish/stockfish-19-lite-single.js", new URL(".", document.baseURI || location.href));
          this.worker = new Worker(workerUrl);
        } catch (err) {
          reject(err);
          return;
        }
        this.worker.onerror = (e) => {
          console.error("Stockfish worker error", e);
        };
        this.worker.onmessage = (e) => {
          const line = typeof e.data === "string" ? e.data : (e.data && e.data.text) || String(e.data);
          this._onLine(line);
        };
        const timeout = setTimeout(() => reject(new Error("Engine startup timed out")), 40000);
        this._bootResolve = (ok) => {
          clearTimeout(timeout);
          if (ok) resolve(this);
          else reject(new Error("Engine failed to start"));
        };
        this.post("uci");
      });
      return this._readyPromise;
    }

    post(cmd) {
      if (this.worker) this.worker.postMessage(cmd);
    }

    _onLine(line) {
      if (!line) return;
      if (line.startsWith("option name UCI_Elo")) this.options.hasElo = true;
      if (line.startsWith("option name Skill Level")) this.options.hasSkill = true;
      if (line.startsWith("option name UCI_LimitStrength")) this.options.hasLimit = true;
      if (line === "uciok") {
        this.post("isready");
        return;
      }
      if (line === "readyok") {
        this.ready = true;
        if (this._bootResolve) {
          const r = this._bootResolve;
          this._bootResolve = null;
          r(true);
        }
        if (this._waiting && this._waiting.type === "ready") {
          this._waiting.resolve();
          this._waiting = null;
        }
        return;
      }
      if (this._waiting) this._waiting.lines.push(line);
      if (line.startsWith("bestmove") && this._waiting && this._waiting.type === "go") {
        const w = this._waiting;
        this._waiting = null;
        w.resolve(w.lines);
      }
    }

    async isReady() {
      if (!this.ready) await this.start();
      await new Promise((resolve) => {
        this._waiting = { type: "ready", resolve, lines: [] };
        this.post("isready");
      });
    }


    async setCoachingStrength() {
      await this.isReady();
      this._strength.coaching = true;
      if (this.options.hasLimit) this.post("setoption name UCI_LimitStrength value false");
      if (this.options.hasSkill) this.post("setoption name Skill Level value 20");
      await this.isReady();
    }

    async restorePlayStrength() {
      const elo = this._strength.elo;
      const skill = this._strength.skill;
      this._strength.coaching = false;
      if (elo != null || skill != null) await this.setStrength(elo, skill);
    }

    async setStrength(elo, skill) {
      await this.isReady();
      this._strength.elo = elo;
      this._strength.skill = skill;
      if (this._strength.coaching) return;
      if (elo >= 1320 && this.options.hasLimit && this.options.hasElo) {
        this.post("setoption name UCI_LimitStrength value true");
        this.post("setoption name UCI_Elo value " + Math.min(3190, elo));
      } else if (this.options.hasLimit) {
        this.post("setoption name UCI_LimitStrength value false");
      }
      if (this.options.hasSkill && skill != null) this.post("setoption name Skill Level value " + Math.max(0, Math.min(20, skill)));
      await this.isReady();
    }

    analyze(fen, opts) {
      const run = () => this._analyzeNow(fen, opts);
      const next = this._queue.then(run, run);
      this._queue = next.then(() => {}, () => {});
      return next;
    }

    async _analyzeNow(fen, opts) {
      await this.isReady();
      const depth = opts && opts.depth;
      const movetime = opts && opts.movetime;
      const multipv = (opts && opts.multipv) || 1;
      const searchmoves = (opts && opts.searchmoves) || [];
      this.post("setoption name MultiPV value " + multipv);
      this.post("position fen " + fen);
      const go = [];
      if (depth) go.push("depth " + depth);
      if (movetime) go.push("movetime " + movetime);
      if (searchmoves.length) go.push("searchmoves " + searchmoves.join(" "));
      const cmd = "go " + (go.length ? go.join(" ") : "depth 12");
      const lines = await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("analyze timeout")), (movetime || 2000) + 8000);
        this._waiting = {
          type: "go",
          lines: [],
          resolve: (ls) => {
            clearTimeout(t);
            resolve(ls);
          },
        };
        this.post(cmd);
      });
      return this._parseInfo(lines, fen);
    }

    _parseInfo(lines, fen) {
      const pvs = {};
      let bestmove = null;
      for (const line of lines) {
        if (line.startsWith("bestmove")) {
          bestmove = line.split(/\s+/)[1];
        }
        if (!line.startsWith("info ") || line.indexOf(" pv ") === -1) continue;
        const mp = /multipv (\d+)/.exec(line);
        const idx = mp ? parseInt(mp[1], 10) : 1;
        const mate = /score mate (-?\d+)/.exec(line);
        const cp = /score cp (-?\d+)/.exec(line);
        const pvMatch = / pv (.+)$/.exec(line);
        const depth = / depth (\d+)/.exec(line);
        const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];
        let score = 0;
        let isMate = false;
        if (mate) {
          isMate = true;
          score = parseInt(mate[1], 10);
        } else if (cp) {
          score = parseInt(cp[1], 10);
        }
        // Later, deeper infos overwrite
        pvs[idx] = { score, isMate, pv, depth: depth ? parseInt(depth[1], 10) : 0 };
      }
      const list = Object.keys(pvs)
        .map((k) => parseInt(k, 10))
        .sort((a, b) => a - b)
        .map((k) => pvs[k]);
      return { bestmove, pvs: list, fen };
    }

    async quit() {
      try {
        this.post("quit");
        this.worker && this.worker.terminate();
      } catch (e) {}
    }
  }

  window.StockfishEngine = StockfishEngine;
})();
