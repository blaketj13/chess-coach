/* Scored Find-your-openings quiz: style answers plus Blake's Chess.com results. */
(function () {
  const QUESTIONS = [
    {
      id: "white-feel",
      text: "As White against 1…e5, what feels right?",
      choices: [
        { id: "solid", label: "A slow, solid center — c3 and d4, one clear plan.", tags: { ponziani: 3, alapin: 2, scotch: 1, vienna: 0 } },
        { id: "sharp", label: "Something sharp: a knight on c3 and an early f4.", tags: { vienna: 3, scotch: 1, ponziani: 0, alapin: 0 } },
        { id: "open", label: "Open the center at once with d4 and develop freely.", tags: { scotch: 3, vienna: 1, ponziani: 1, alapin: 1 } }
      ]
    },
    {
      id: "theory",
      text: "How much opening theory do you want to carry?",
      choices: [
        { id: "less", label: "Less theory, a plan I can remember.", tags: { ponziani: 2, alapin: 2, caro: 2, pirc: 2, scotch: 1, vienna: 0, rousseau: 0 } },
        { id: "some", label: "I don’t mind learning several branches if the ideas are clear.", tags: { vienna: 2, scotch: 2, pirc: 1, caro: 1, ponziani: 1, rousseau: 1, alapin: 1 } },
        { id: "fight", label: "I want a fighting, slightly offbeat weapon.", tags: { rousseau: 3, vienna: 2, pirc: 1, scotch: 0, caro: 0, ponziani: 0 } }
      ]
    },
    {
      id: "black-e4",
      text: "As Black against 1.e4, what’s the feel you want?",
      choices: [
        { id: "counter", label: "A fianchetto setup I can also use against 1.d4, 1.b4 and 1.g3.", tags: { pirc: 3, caro: 0, rousseau: 0 } },
        { id: "gambit", label: "A sharp fight — throw …f5 against the Italian.", tags: { rousseau: 3, pirc: 0, caro: 0 } },
        { id: "solid", label: "Solid first (…c6), then take over later.", tags: { caro: 3, pirc: 1, rousseau: 0 } }
      ]
    },
    {
      id: "races",
      text: "How do you feel about opposite-side attacking races (you storm his king, he storms yours)?",
      choices: [
        { id: "yes", label: "That’s the kind of game I want.", tags: { vienna: 2, rousseau: 2, pirc: 2, scotch: 1, ponziani: 0, caro: 0, alapin: 0 } },
        { id: "sometimes", label: "Sometimes, if I’m ready for it.", tags: { pirc: 2, scotch: 2, vienna: 1, rousseau: 1, ponziani: 1, caro: 1, alapin: 1 } },
        { id: "no", label: "I’d rather castle the same side and play through the center.", tags: { ponziani: 2, caro: 2, alapin: 2, scotch: 1, pirc: 0, vienna: 0, rousseau: 0 } }
      ]
    },
    {
      id: "unusual",
      text: "When someone opens 1.b4 or 1.g3 (1.b4 or 1.g3), what do you want?",
      choices: [
        { id: "same", label: "The same setup I already know — the g7 bishop, then a central break.", tags: { pirc: 3, caro: 0, rousseau: 0 } },
        { id: "center", label: "Grab the center with pawns at once, then decide.", tags: { pirc: 2, caro: 0, rousseau: 0 } },
        { id: "each", label: "A different opening for every first move.", tags: { pirc: 1, caro: 0, rousseau: 0 } }
      ]
    }
  ];

  const CANDIDATES = [
    { id: "ponziani", name: "Ponziani", color: "white", family: "ponziani", vs: "1…e5",
      moves: "1.e4 e5 2.Nf3 Nc6 3.c3, aiming for d4",
      pros: "Clear plan (c3 and d4), less theory than the Ruy or Italian, and you’ve already scored well with it.",
      cons: "3.c3 takes the knight’s square; you have to know 3…d5 and 3…Nf6. Don’t mix it with an early f4." },
    { id: "vienna", name: "Vienna (with the Vienna Gambit)", color: "white", family: "vienna", vs: "1…e5",
      moves: "1.e4 e5 2.Nc3, then 3.f4 or 3.Bc4",
      pros: "Your sharp second opening. The gambit is a real fight, and the quiet 3.Bc4 is there when you want it.",
      cons: "You must know 3…d5 against the gambit, and the fork trick 3…Nxe4. Never combine this with c3 in the same game." },
    { id: "scotch", name: "Scotch", color: "white", family: "scotch", vs: "1…e5",
      moves: "1.e4 e5 2.Nf3 Nc6 3.d4",
      pros: "Opens the center at once. You’ve scored well with it as White. The branches are named by what he does after 4.Nxd4.",
      cons: "More ‘which line am I in?’ than the Ponziani. 2…Nf6 is a Petrov, not a Scotch." },
    { id: "alapin", name: "Alapin Sicilian", color: "white", family: "sicilian", vs: "1…c5",
      moves: "1.e4 c5 2.c3, aiming for d4",
      pros: "The same c3-then-d4 idea as the Ponziani, and a respected, low-theory weapon against the Sicilian.",
      cons: "You still need 2…d5 and 2…Nf6. This is your White answer to 1…c5, not a third way vs 1…e5." },
    { id: "pirc", name: "Pirc (and the Modern setup vs non-e4)", color: "black", family: "pirc", vs: "1.e4, and the same setup vs 1.d4 / 1.c4 / 1.b4 / 1.g3",
      moves: "1.e4 d6 2.d4 Nf6 3.Nc3 g6, then …Bg7",
      pros: "One setup that also covers 1.b4 and 1.g3. The attacking plans are now split by what White does.",
      cons: "The setup is easy; the work is the plan after it. Don’t sit behind …d6, and don’t throw an early h-pawn." },
    { id: "rousseau", name: "Rousseau Gambit", color: "black", family: "italian", vs: "1.e4 e5 2.Nf3 Nc6 3.Bc4 f5",
      moves: "3…f5 only against 3.Bc4 (or 3.Bb5, the Schliemann)",
      pros: "A fighting, offbeat weapon against the Italian. You’ll catch club players who don’t know 4.d4 and 4.d3.",
      cons: "It’s a fight, not an engine-equal opening. It does not apply vs 3.d4, 3.c3, or vs 1.b4 / 1.g3." },
    { id: "caro", name: "Caro-Kann", color: "black", family: "caro-kann", vs: "1.e4 only",
      moves: "1.e4 c6 2.d4 d5",
      pros: "Solid, one pawn break (…d5), and you’ve played a lot of it. Good when you want a quieter Black game.",
      cons: "Only answers 1.e4. Against 1.b4 or 1.g3, use the Pirc/Modern setup instead." }
  ];

  function familyStat(stats, family, color) {
    if (!stats || !stats.byFamily) return null;
    const fam = stats.byFamily[family];
    if (!fam) return null;
    return fam[color] || null;
  }

  function statScore(st) {
    if (!st || !st.games) return 0;
    const wr = typeof st.winRate === "number" ? st.winRate : (100 * (st.wins + 0.5 * (st.draws || 0)) / st.games);
    const volume = Math.min(1, Math.log(1 + st.games) / Math.log(1 + 250));
    /* 0–25 points from real results: win rate around 50% is neutral-ish, volume matters. */
    return Math.round((wr - 40) * 0.5 * volume + volume * 8);
  }

  function styleScore(answers, id) {
    let s = 0;
    QUESTIONS.forEach((q) => {
      const pick = answers[q.id];
      const ch = (q.choices || []).find((c) => c.id === pick);
      if (ch && ch.tags && typeof ch.tags[id] === "number") s += ch.tags[id];
    });
    return s;
  }

  function score(answers, stats) {
    answers = answers || {};
    const rows = CANDIDATES.map((c) => {
      const style = styleScore(answers, c.id);
      const st = familyStat(stats, c.family, c.color);
      const fromStats = statScore(st);
      /* style is 0–13 or so; stats -5 to 25. Combine into a 0–100 display score. */
      const raw = style * 8 + fromStats;
      const display = Math.max(0, Math.min(100, Math.round(40 + raw)));
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        vs: c.vs,
        moves: c.moves,
        pros: c.pros,
        cons: c.cons,
        style: style,
        stat: st,
        statPoints: fromStats,
        score: display,
        raw: raw
      };
    });
    rows.sort((a, b) => b.raw - a.raw);
    const white = rows.filter((r) => r.color === "white").sort((a, b) => b.raw - a.raw);
    const black = rows.filter((r) => r.color === "black").sort((a, b) => b.raw - a.raw);
    return { all: rows, white: white, black: black };
  }

  function formatStat(st) {
    if (!st || !st.games) return "No games in this family in your Chess.com file.";
    return st.wins + "–" + (st.draws || 0) + "–" + st.losses + " in " + st.games +
      " games (" + st.winRate + "%). Reached move 15 in " + (st.reachedMove15Pct || "—") + "%." +
      (st.accuracyGames ? " Accuracy (sample of " + st.accuracyGames + "): " + st.accuracyAvg + "." : "");
  }

  function unusualNote(answers) {
    if (answers && answers.unusual === "each") {
      return "One thing the quiz has to flag: the Rousseau and the Caro-Kann only answer 1.e4. Against 1.b4 and 1.g3, the Pirc/Modern setup is still the repertoire answer, even if you like having a different opening for each first move.";
    }
    return "";
  }

  window.FindOpenings = {
    QUESTIONS: QUESTIONS,
    CANDIDATES: CANDIDATES,
    score: score,
    familyStat: familyStat,
    formatStat: formatStat,
    unusualNote: unusualNote
  };
})();
