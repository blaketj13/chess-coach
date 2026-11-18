/* 1.6.1 Board stays in view. After a move, reveal, wrong-answer panel or drill result, the board you just
   played on must stay fully on screen. Nothing here scrolls the board away:
   - every BoardUI root carries data-testid="board";
   - boards are capped so board + a feedback panel fit the scroll area (--board-cap);
   - keep(panel) scrolls only as far as the board's top allows, then lets the panel scroll inside itself;
   - a watcher re-checks after any change in the main area (covers every view, old and new). */
(function () {
  const PANELS = ".ls-feedback, .ls-reveal, #drill-fb, #learn-fb, #c-fb, .pr-feedback, .pr-fb, .coach-feed, #coach-box, .th-fb, .rush-msg, #rush-msg, #clock-msg, .calc-reveal";
  const main = () => document.querySelector(".main");
  function insets() {
    const cs = getComputedStyle(document.documentElement);
    const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
    return { top: px("--sat"), bottom: px("--sab") };
  }
  function shown(el) {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  /** The board the player is looking at: overlays first, then the largest visible board in the main area. */
  function activeBoard() {
    const all = Array.from(document.querySelectorAll('[data-testid="board"]')).filter(shown);
    if (!all.length) return null;
    const inOv = all.filter((b) => b.closest(".overlay"));
    const pool = inOv.length ? inOv : all;
    return pool.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  }
  /** The visible band a board must fit in: the main scroll area (or the viewport for overlays), minus system bars. */
  function region(board) {
    const ins = insets();
    let top = ins.top, bottom = window.innerHeight - ins.bottom;
    const m = main();
    if (m && board && m.contains(board)) {
      const r = m.getBoundingClientRect();
      top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom);
    }
    return { top, bottom, left: 0, right: window.innerWidth };
  }
  function boardInView() {
    const b = activeBoard();
    const vp = { width: window.innerWidth, height: window.innerHeight, sat: insets().top, sab: insets().bottom };
    if (!b) return { visible: false, rect: null, viewport: vp, reason: "no board on screen" };
    const r = b.getBoundingClientRect(), g = region(b);
    const visible = r.top >= g.top - 1 && r.bottom <= g.bottom + 1 && r.left >= -1 && r.right <= g.right + 1;
    return { visible, rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }, viewport: Object.assign(vp, { top: g.top, bottom: g.bottom }), id: b.id || null };
  }
  /** Bring the board fully into view (minimal scroll), then fit the panel below it without moving the board out. */
  function keep(panel) {
    // The page itself never scrolls (overflow hidden); undo any stray programmatic scroll of it.
    const se = document.scrollingElement; if (se && se.scrollTop) se.scrollTop = 0;
    const m = main(), b = activeBoard();
    if (!m || !b || !m.contains(b)) return;
    const g = region(b);
    let br = b.getBoundingClientRect();
    if (br.top < g.top) m.scrollTop -= g.top - br.top + 4;
    else if (br.bottom > g.bottom) m.scrollTop += Math.min(br.bottom - g.bottom + 4, Math.max(0, br.top - g.top - 4));
    panel = panel || Array.from(m.querySelectorAll(PANELS)).filter(shown).pop();
    if (!panel || !m.contains(panel)) return;
    // Drop a stale cap so a later board shrink can give the panel its room back.
    if (panel.classList.contains("panel-fit")) {
      panel.style.maxHeight = "";
      panel.style.overflowY = "";
      panel.classList.remove("panel-fit");
    }
    br = b.getBoundingClientRect();
    let pr = panel.getBoundingClientRect();
    if (pr.top < br.bottom) return; // panel sits above or beside the board: nothing to do
    if (pr.bottom > g.bottom) {
      const room = Math.max(0, br.top - g.top - 4); // never scroll past the board's top
      m.scrollTop += Math.min(room, pr.bottom - g.bottom + 6);
      pr = panel.getBoundingClientRect();
    }
    if (pr.bottom > g.bottom + 1 && pr.top < g.bottom - 60) {
      panel.style.maxHeight = Math.floor(g.bottom - pr.top - 4) + "px";
      // The inner .ls-fb-body scrolls; the Try again button stays pinned.
      panel.style.overflowY = "hidden";
      panel.classList.add("panel-fit");
    }
    // If the why/alternative is still clipped and the tab bar left a gap, use it.
    const body = panel.querySelector(".ls-fb-body");
    if (body && body.scrollHeight > body.clientHeight + 1) {
      const room = Math.max(0, m.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom - 4);
      if (room > 0) {
        const h = panel.getBoundingClientRect().height;
        panel.style.maxHeight = Math.floor(h + room) + "px";
      }
    }
  }
  /** Board size cap: leave ~180px under the board for the prompt and a panel. */
  function sizeCap() {
    const m = main(); if (!m) return;
    const h = m.clientHeight || window.innerHeight;
    document.documentElement.style.setProperty("--board-cap", Math.max(200, Math.round(h - 210)) + "px");
  }
  let pending = 0;
  function schedule() {
    if (pending) return;
    pending = requestAnimationFrame(() => requestAnimationFrame(() => {
      pending = 0;
      try { keep(); } catch (e) {}
      // One more pass after :has() board-cap styles settle.
      requestAnimationFrame(() => { try { keep(); } catch (e) {} });
    }));
  }
  function watch() {
    const m = main(); if (!m) return;
    sizeCap();
    new MutationObserver((list) => {
      // Only react to panels and boards appearing, not to every square repaint.
      for (const rec of list) {
        if (rec.type === "attributes") { if (rec.target.matches && rec.target.matches(PANELS) && !rec.target.hidden) return schedule(); continue; }
        for (const n of rec.addedNodes) {
          if (n.nodeType === 1 && (n.matches(PANELS) || n.querySelector && n.querySelector(PANELS + ', [data-testid="board"]'))) return schedule();
          if (n.nodeType === 1 && rec.target.matches && rec.target.matches(PANELS)) return schedule(); // panel text changed
        }
      }
    }).observe(m, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    window.addEventListener("resize", () => { sizeCap(); schedule(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
  window.BoardView = { keep, boardInView, activeBoard, sizeCap };
  window.__qa = window.__qa || {};
  window.__qa.boardInView = boardInView;
})();
