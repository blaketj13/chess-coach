/* Thinking routine and attacking ideas inspired by GM Igor Smirnov's
   public Remote Chess Academy lessons. Paraphrased, not copied.
   Not affiliated with or endorsed by RCA or GM Smirnov. */
(function () {
  const CREDIT = "Inspired by GM Igor Smirnov's public teaching (Remote Chess Academy). Not affiliated with or endorsed by him or RCA.";

  /* Before-move routine, paraphrased from his public calculation/thinking lessons:
     evaluate first; checks-captures-threats; opponent's best reply;
     least-active piece; go forward and create threats; anti-blunder check. */
  const ROUTINE = [
    { id: "evaluate", title: "What's going on?", prompt: "Look at material, king safety, piece activity, and any threats. Don't start calculating until you know the story of the position." },
    { id: "intent", title: "What did his last move want?", prompt: "Name the idea behind his last move. Is anything of yours now under fire on your side of the board?" },
    { id: "forcing", title: "Checks, captures, threats", prompt: "Scan forcing moves first — checks, captures, and real threats. They're the strongest ideas and the easiest to calculate." },
    { id: "worst", title: "Which is your worst piece?", prompt: "If nothing is forcing, find your most passive piece and improve it. When every piece is working, start looking toward his side of the board." },
    { id: "candidate", title: "Pick a move, then try to break it", prompt: "Choose a candidate, then look for his most aggressive reply (a check, capture, or threat). If that reply holds up, the move isn't safe." }
  ];

  /* Attacking principles paraphrased from his public "Top 10 Attacking Principles"
     and related RCA lessons (least-active piece, unmotivated captures, counterattack). */
  const PRINCIPLES = [
    { id: "open-center", name: "Open the center vs an uncastled king", cue: "His king is still in the middle. Opening the center usually hits harder than a wing raid.", lesson: "If his king hasn't castled, pawn breaks in the center open lines for your pieces to reach him. Don't start a flank attack while the center can still blow open." },
    { id: "remove-defender", name: "Remove a key defender", cue: "A piece that's holding his king together can often be traded or driven off.", lesson: "Before throwing pieces at the king, ask which of his pieces is the main defender. Trade it, chase it, or overload it, and the attack gets much easier." },
    { id: "outnumber", name: "Outnumber the defenders", cue: "Count attackers versus defenders around his king. You want more attackers than he can cover.", lesson: "An attack works when you have more pieces hitting the target than he has defending it. If the count isn't in your favor yet, bring one more piece up before you sacrifice or rush in." },
    { id: "invade", name: "Get pieces onto his side", cue: "Look for a way to step a piece forward onto his half of the board and create a threat.", lesson: "A useful question when you're ready to attack: how can I go to his side of the board and create a threat? Forward moves that make him answer are the ones that win games." },
    { id: "forcing", name: "Checks, captures, threats first", cue: "There's a forcing move on the board. Check it before you play a quiet one.", lesson: "Checks, captures, and threats force a reply, so they're easier to calculate and often stronger than a slow improving move. Scan them first, every time." },
    { id: "counterattack", name: "Meet a threat with a stronger threat", cue: "Before you retreat or defend, look for a counterpunch — a stronger threat of your own.", lesson: "The best defense is often a bigger threat. If he attacks a piece, ask whether you can check, capture, or threaten something more valuable instead of backing up." },
    { id: "momentum", name: "Keep the attack moving", cue: "Once you've started the attack, look for the next forcing move so he doesn't get time to regroup.", lesson: "Initiative means making him answer you every turn. After a good attacking move, keep looking for the next check, capture, or threat so the pressure doesn't fizzle." },
    { id: "sac-lines", name: "Sacrifice to open a line", cue: "If a sacrifice rips open the file or diagonal toward his king, it's worth a close look.", lesson: "Material is a tool. Giving a pawn or piece to open a file, diagonal, or the king's shield can be right when your other pieces are ready to pour in." },
    { id: "attack-center", name: "Strike in the center", cue: "The center is the highway. A break there can turn a slow game into an attack.", lesson: "Many attacks are prepared by a central pawn break. If your pieces are developed, ...d5 or e4/e5 (depending on color) often opens the path to his king." },
    { id: "seventh", name: "Rook on the seventh", cue: "A rook that lands on his second rank usually ties his king and pawns down.", lesson: "A rook on the 7th rank (the 2nd, if you're Black) attacks pawns from behind and hems in the king. It's often the finishing touch of an attack or a winning endgame idea." },
    { id: "least-active", name: "Improve your worst piece", cue: "One of your pieces isn't working. Bring it into the game before you launch anything.", lesson: "Don't attack with half your army. Find the piece doing the least and give it a better square. Once everything is active, then look for a way forward." },
    { id: "dont-grab", name: "Don't capture just because you can", cue: "That capture may help him develop or lose you a tempo. Check who benefits from the trade.", lesson: "Unmotivated exchanges often help the other side: he develops a piece, opens a line, or gets out of a squeeze. Only take when the trade clearly helps your plan." }
  ];

  const byId = {};
  PRINCIPLES.forEach((p) => { byId[p.id] = p; });

  function kingSq(chess, color) {
    const b = chess.board();
    const files = "abcdefgh";
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = b[r][f];
      if (p && p.type === "k" && p.color === color) return files[f] + (8 - r);
    }
    return null;
  }

  function squareCoords(sq) {
    return { f: "abcdefgh".indexOf(sq[0]), r: parseInt(sq[1], 10) };
  }

  function aroundKing(ks) {
    if (!ks) return [];
    const { f, r } = squareCoords(ks);
    const out = [ks];
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
      const ff = f + df, rr = r + dr;
      if (ff >= 0 && ff < 8 && rr >= 1 && rr <= 8) out.push("abcdefgh"[ff] + rr);
    }
    return out;
  }

  function uncastled(chess, color) {
    const ks = kingSq(chess, color);
    return color === "w" ? ks === "e1" : ks === "e8";
  }

  function developedCount(chess, color) {
    const back = color === "w" ? "1" : "8";
    const home = color === "w" ? ["b1","c1","f1","g1"] : ["b8","c8","f8","g8"];
    let homeN = 0;
    home.forEach((sq) => {
      const p = chess.get(sq);
      if (p && p.color === color && (p.type === "n" || p.type === "b")) homeN++;
    });
    return 4 - homeN;
  }

  function worstPiece(chess, color) {
    const back = color === "w" ? "1" : "8";
    const b = chess.board();
    const files = "abcdefgh";
    const idle = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = b[r][f];
      if (!p || p.color !== color || p.type === "k" || p.type === "p") continue;
      const sq = files[f] + (8 - r);
      if (p.type === "n" && (sq === "b" + back || sq === "g" + back)) idle.push({ sq, name: "knight" });
      if (p.type === "b" && (sq === "c" + back || sq === "f" + back)) idle.push({ sq, name: "bishop" });
      if (p.type === "r" && (sq === "a" + back || sq === "h" + back)) idle.push({ sq, name: "rook" });
    }
    return idle[0] || null;
  }

  /* Count pieces of `color` that attack any square in the ring around the enemy king. */
  function attackCount(chess, color, enemyKing) {
    const ring = aroundKing(enemyKing);
    const attackers = new Map();
    const moves = [];
    // Use Coach.attackers if available
    const attackerFn = window.Coach && window.Coach.attackers;
    ring.forEach((sq) => {
      let atts = [];
      if (attackerFn) atts = attackerFn(chess, sq, color);
      else {
        const tmp = new Chess(chess.fen());
        const ms = tmp.moves({ verbose: true });
        atts = ms.filter((m) => m.to === sq);
      }
      atts.forEach((m) => {
        if (!attackers.has(m.from)) attackers.set(m.from, { from: m.from, piece: m.piece, to: sq });
      });
    });
    attackers.forEach((v) => moves.push(v));
    return moves;
  }

  function detectAttack(chess, us) {
    const them = us === "w" ? "b" : "w";
    const ek = kingSq(chess, them);
    const ok = kingSq(chess, us);
    if (!ek) return null;
    const ourHits = attackCount(chess, us, ek);
    const theirDef = attackCount(chess, them, ek);
    const arrows = ourHits.slice(0, 6).map((a) => ({ from: a.from, to: a.to, color: "#e0c56a" }));
    const nAtt = ourHits.length;
    const nDef = theirDef.length;
    const undeveloped = 4 - developedCount(chess, us);
    const idle = worstPiece(chess, us);
    const theyUncastled = uncastled(chess, them);

    let id = null;
    if (theyUncastled && developedCount(chess, us) >= 3) id = "open-center";
    else if (idle && undeveloped >= 2 && nAtt < 3) id = "least-active";
    else if (nAtt >= 3 && nAtt > nDef) id = "outnumber";
    else if (nAtt >= 2 && nAtt <= nDef) id = "outnumber";
    else if (nAtt >= 2) id = "invade";

    if (!id) return null;
    const p = byId[id];
    let cue = p.cue;
    if (id === "outnumber") {
      cue = "Count: you have " + nAtt + " attacker" + (nAtt === 1 ? "" : "s") + " near his king, he has " + nDef + " defender" + (nDef === 1 ? "" : "s") + ".";
    }
    if (id === "least-active" && idle) {
      cue = "Your " + idle.name + " on " + idle.sq + " isn't in the game yet. Improve your worst piece before you attack.";
    }
    return {
      principle: p,
      attackers: nAtt,
      defenders: nDef,
      arrows,
      cue,
      highlights: ourHits.slice(0, 4).map((a) => ({ square: a.from, kind: "take" }))
    };
  }

  function missedPrinciple(review) {
    if (!review || !review.principleId) return null;
    return byId[review.principleId] || null;
  }

  window.Smirnov = {
    CREDIT,
    ROUTINE,
    PRINCIPLES,
    principle: (id) => byId[id],
    detectAttack,
    worstPiece,
    uncastled,
    developedCount,
    attackCount,
    missedPrinciple
  };
})();
