/* FSRS-4.5 (simplified) for on-device spaced repetition. */
(function () {
  const W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
  const DECAY = -0.5;
  const FACTOR = 19 / 81;

  function now() { return Date.now(); }
  function daysBetween(a, b) { return Math.max(0, (b - a) / 86400000); }

  function retrievability(card, at) {
    const elapsed = daysBetween(card.lastReview || at, at);
    const s = Math.max(0.1, card.stability || 0.4);
    return Math.pow(1 + FACTOR * elapsed / s, DECAY);
  }

  function next(card, rating, at) {
    at = at || now();
    const r = Math.max(1, Math.min(4, rating));
    const copy = Object.assign({}, card);
    copy.reps = (copy.reps || 0) + 1;
    if (!copy.lastReview) {
      copy.difficulty = Math.max(1, Math.min(10, W[4] - Math.exp(W[5] * (r - 1)) + 1));
      copy.stability = Math.max(0.1, W[r - 1]);
    } else {
      const d = copy.difficulty || 5;
      const s = copy.stability || 0.4;
      const ret = retrievability(copy, at);
      if (r === 1) {
        copy.lapses = (copy.lapses || 0) + 1;
        copy.difficulty = Math.min(10, d + W[6]);
        copy.stability = Math.max(0.1, W[0] * s * Math.exp(W[7] * (1 - ret)));
      } else {
        copy.difficulty = Math.max(1, d - (r - 3) * W[6]);
        const hardPen = r === 2 ? W[15] : 1;
        const easyB = r === 4 ? W[16] : 1;
        const inc = 1 + Math.exp(W[8]) * (11 - copy.difficulty) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - ret)) - 1);
        copy.stability = Math.max(0.1, s * inc * hardPen * easyB);
      }
    }
    copy.lastReview = at;
    const interval = copy.stability;
    copy.due = at + interval * 86400000;
    return copy;
  }

  function newCard(seed) {
    return Object.assign({
      difficulty: 5,
      stability: 0.4,
      reps: 0,
      lapses: 0,
      lastReview: 0,
      due: now()
    }, seed || {});
  }

  function due(cards, at) {
    at = at || now();
    return (cards || []).filter((c) => !c.due || c.due <= at).sort((a, b) => (a.due || 0) - (b.due || 0));
  }

  window.SCFSRS = { next, newCard, due, retrievability };
})();
