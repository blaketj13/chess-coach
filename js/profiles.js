/* Style-mimic opponent personas. Books come from the CC0 lichess-org/chess-openings dataset, not from any real player's games. */
window.PROFILES = {
  "fianchetto-grinder": {
    id: "fianchetto-grinder",
    name: "The Fianchetto Grinder",
    shortName: "Fianchetto Grinder",
    rating: 1350,
    ratingLabel: "~1300–1400",
    elo: 1350,
    skill: 9,
    blurb: "Slow flank systems: 1.g3 and 1.b4, a kingside fianchetto, and a long build-up. Castles short and plays for a squeeze.",
    setups: {
      black: [
        { vs: "1.g3", plan: "Take the center with …d5 and …e5, develop, and castle before any h-pawn attack." },
        { vs: "1.b4", plan: "Play …d5, develop, and castle. Don’t hunt the b-pawn." }
      ],
      white: [
        { vs: "…g6 / Modern", plan: "Take the center, develop, and castle. Trade the g7 bishop only when your king is safe." }
      ]
    }
  },
  "gambiteer": {
    id: "gambiteer",
    name: "The Gambiteer",
    shortName: "Gambiteer",
    rating: 1250,
    ratingLabel: "~1200–1350",
    elo: 1250,
    skill: 8,
    blurb: "Opens 1.e4 and goes after early pawn sacrifices: King’s Gambit, Vienna Gambit, Danish and Evans ideas. Expect a fast attack.",
    setups: {
      black: [
        { vs: "1.e4 and a gambit", plan: "Take the center with …d5 when you can, develop, and castle. Don’t get caught in the open with the king on e8." }
      ],
      white: [
        { vs: "A sharp …e5 or …c5", plan: "Develop and castle first. You don’t have to take every pawn that’s offered." }
      ]
    }
  },
  "solid-defender": {
    id: "solid-defender",
    name: "The Solid Defender",
    shortName: "Solid Defender",
    rating: 1200,
    ratingLabel: "~1100–1300",
    elo: 1200,
    skill: 7,
    blurb: "Classical and sturdy: Italian and London systems as White, Caro-Kann or a solid …e5 as Black. Slow, safe, and hard to budge.",
    setups: {
      black: [
        { vs: "1.e4 (Italian / Spanish)", plan: "Develop knights and bishops, castle, and wait for a clear pawn break." },
        { vs: "1.d4 (London / Colle)", plan: "Play …d5, …e6, …Nf6, …Be7, and castle. Don’t rush the c5 or e5 break." }
      ],
      white: [
        { vs: "…c6 or …e5", plan: "A simple developing plan is enough: knights out, castle, then a central break." }
      ]
    }
  },
  "wing-pawn-opener": {
    id: "wing-pawn-opener",
    name: "The Wing-Pawn Opener",
    shortName: "Wing-Pawn Opener",
    rating: 1000,
    ratingLabel: "~900–1100",
    elo: 1000,
    skill: 5,
    blurb: "Likes early wing pawns: 1.a4, 1.h4, 1.b4 and other odd first moves. The center can stay empty, so take it and castle.",
    setups: {
      black: [
        { vs: "1.a4, 1.h4, or 1.b4", plan: "Play …d5 or …e5, develop, and castle. Ignore the wing pawn until your king is safe." }
      ],
      white: [
        { vs: "An unusual reply", plan: "Take the center, develop, and castle. Don’t chase a wing pawn with your queen." }
      ]
    }
  }
};

window.COACH_PRINCIPLES = [
  "Develop a knight or bishop, then castle, before you start an attack.",
  "Before you move, check: what did he just threaten, and is anything of yours hanging?",
  "If you’re ahead, trade pieces, not just pawns. A simpler position is easier to win.",
  "Don’t bring the queen out early. She gets chased and you fall behind in development.",
  "Don’t open the center while your king is still on its starting square.",
  "If a piece can be taken for free, take it — or make sure yours isn’t the one hanging.",
  "You don’t need a long memorized line here. Develop, castle, and keep your pieces safe."
];
