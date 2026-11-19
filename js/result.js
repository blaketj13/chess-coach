/* 1.6.2 game result: XP for every finished game (Play, rivals, placement), a count-up tally and a level bar.
   XP is tied to clean thinking and the finish, never to time spent. Values are placeholders Blake can tune. */
(function () {
  const XP = { win: 40, draw: 20, loss: 10, clean: 3, cleanCap: 20, mate: 15, minPlies: 6 };

  /** o = { result: "win"|"draw"|"loss", clean, mate, plies } -> { rows: [[label, xp]], total } */
  function compute(o) {
    const rows = [];
    if (!o || (o.plies || 0) < XP.minPlies) return { rows, total: 0 };
    rows.push([o.result === "win" ? "Win" : o.result === "draw" ? "Draw" : "Game played", XP[o.result] || 0]);
    const c = Math.min(o.clean || 0, XP.cleanCap);
    if (c) rows.push(["Clean moves ×" + c, c * XP.clean]);
    if (o.mate && o.result === "win") rows.push(["Mate finish", XP.mate]);
    return { rows, total: rows.reduce((s, r) => s + r[1], 0) };
  }

  function award(o) {
    const P = window.Progress;
    const t = compute(o);
    const before = P ? P.get().xp : 0;
    let r = { gain: 0, levelUp: null };
    if (P && t.total > 0) r = P.addXp(t.total, { keepCombo: true });
    const info = Object.assign({}, t, o, { before, after: P ? P.get().xp : before, levelUp: r.levelUp, gain: r.gain });
    window.__qa = window.__qa || {};
    window.__qa.lastGameXp = info;
    return info;
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function tallyHtml(info) {
    if (!info) return "";
    const P = window.Progress;
    const lv = P ? P.levelOf(info.after) : { level: 1 };
    const rows = (info.rows || []).map((r) => `<div class="gr-row"><span>${esc(r[0])}</span><b>+${r[1]}</b></div>`).join("");
    return `<div class="gr-tally" data-testid="xp-tally">${rows}
      <div class="gr-total"><span>XP earned</span><b data-testid="xp-total" data-to="${info.total}">+${info.total}</b></div>
      <div class="gr-level"><div class="gr-bar" data-testid="level-bar"><i></i></div><span class="gr-lv${info.levelUp ? " up" : ""}" data-testid="level-chip">${info.levelUp ? "▲ Level " + info.levelUp : "Level " + lv.level}</span></div></div>`;
  }

  /** Count the total up and fill the level bar (instant under reduced motion). */
  function animate(root, info) {
    if (!root || !info) return;
    const P = window.Progress, F = window.Feel;
    const tot = root.querySelector("[data-testid=xp-total]");
    if (tot && F && F.countUp) F.countUp(tot, info.total, { prefix: "+", ms: 900 });
    const bar = root.querySelector(".gr-bar i");
    if (bar && P) {
      const a = P.levelOf(info.after), b = P.levelOf(info.before);
      const fromPct = info.levelUp ? 0 : Math.round((b.into / b.need) * 100);
      const toPct = Math.round((a.into / a.need) * 100);
      bar.style.width = fromPct + "%";
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = Math.max(2, toPct) + "%"; }));
    }
    if (info.levelUp && F) setTimeout(() => { F.sound("level"); F.haptic("level"); }, 700);
  }

  window.GameResult = { XP, compute, award, tallyHtml, animate };
})();
