/* 1.6.1 Rival portraits: original flat-style busts, one silhouette per rival (hair, hat, hood, beard, shoulders).
   Hand-written SVG, no external art. Fictional characters only. */
(function () {
  const ART = {
    // Tess Vane, The Opportunist: sharp asymmetric bob over one eye, sly half-smile, gold earring, collared jacket.
    vane: { bg: "#c9a76a", draw: `
      <path d="M14 100c3-21 17-31 36-31s33 10 36 31z" fill="#3b2f4a"/>
      <path d="M41 69l9 15 9-15z" fill="#efe6d6"/><path d="M36 70l8 18-6 2zM64 70l-8 18 6 2z" fill="#4c3d5e"/>
      <rect x="44" y="55" width="12" height="15" rx="4" fill="#e3b48f"/>
      <ellipse cx="50" cy="42" rx="17" ry="20" fill="#e3b48f"/>
      <path d="M31 46c-3-20 8-31 21-31 14 0 21 10 20 25l1 21c-5-1-8-6-8-13-3-9-11-15-24-14-2 6-3 12-2 21-5-1-8-4-8-9z" fill="#2b1e1a"/>
      <path d="M39 31c10-4 22 1 28 12-8-5-17-7-26-5z" fill="#3a2924"/>
      <path d="M53 38l8-2" stroke="#2b1e1a" stroke-width="2" stroke-linecap="round"/>
      <circle cx="44" cy="43" r="1.9" fill="#1f1a17"/><circle cx="57" cy="42" r="1.9" fill="#1f1a17"/>
      <path d="M44 52q7 3 13-3" stroke="#7a3f33" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <circle cx="69" cy="50" r="2.4" fill="#e2b84a"/>` },
    // Ember, The Attacker: flame hair, angled brows, open grin, high-collar jacket.
    ember: { bg: "#c4623f", draw: `
      <path d="M12 100c3-21 18-32 38-32s35 11 38 32z" fill="#2a1d1a"/>
      <path d="M30 72l12-4 8 10 8-10 12 4-6 12-14-6-14 6z" fill="#e0632f"/>
      <rect x="44" y="56" width="12" height="13" rx="4" fill="#d9a07a"/>
      <ellipse cx="50" cy="44" rx="17" ry="19" fill="#d9a07a"/>
      <path d="M31 42L27 20l10 8 1-17 9 13 5-17 5 16 8-12 1 17 10-7-4 22c-4-8-11-12-21-12s-17 4-21 11z" fill="#e0632f"/>
      <path d="M37 33l2-10 6 8 5-11 4 11 6-8 2 10c-5-3-9-4-13-4s-8 1-12 4z" fill="#f2a03d"/>
      <path d="M38 37l8 3M62 37l-8 3" stroke="#3a1a10" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="43" cy="43" r="2" fill="#1f1a17"/><circle cx="57" cy="43" r="2" fill="#1f1a17"/>
      <path d="M41 51q9 9 18 0z" fill="#fff" stroke="#6b2a1c" stroke-width="1.6" stroke-linejoin="round"/>` },
    // Bastion, The Wall: very broad square shoulders, buzz cut, full beard, turtleneck.
    bastion: { bg: "#6f8296", draw: `
      <path d="M4 100c2-22 20-34 46-34s44 12 46 34z" fill="#3d4652"/>
      <rect x="36" y="58" width="28" height="15" rx="6" fill="#55606d"/>
      <rect x="31" y="20" width="38" height="43" rx="14" fill="#b98563"/>
      <rect x="31" y="17" width="38" height="12" rx="6" fill="#2b2b2b"/>
      <path d="M31 43c1 15 9 22 19 22s18-7 19-22c-5 7-11 10-19 10s-14-3-19-10z" fill="#3a2c22"/>
      <path d="M38 35h9M53 35h9" stroke="#2b2b2b" stroke-width="2.8" stroke-linecap="round"/>
      <circle cx="43" cy="40" r="1.8" fill="#1f1a17"/><circle cx="57" cy="40" r="1.8" fill="#1f1a17"/>
      <path d="M45 56h10" stroke="#1d1611" stroke-width="2" stroke-linecap="round"/>` },
    // Quill, The Trickster: tall hat with a white quill feather, narrow face, curled moustache, sly eyes.
    quill: { bg: "#5f8a6a", draw: `
      <path d="M16 100c3-20 16-30 34-30s31 10 34 30z" fill="#23362c"/>
      <path d="M34 72l16 10 16-10-4 14-12-5-12 5z" fill="#2f4a3b"/>
      <rect x="45" y="56" width="10" height="15" rx="4" fill="#d8a77f"/>
      <ellipse cx="50" cy="44" rx="14" ry="21" fill="#d8a77f"/>
      <rect x="27" y="23" width="46" height="5" rx="2.5" fill="#1e2a24"/>
      <rect x="35" y="4" width="30" height="21" rx="3" fill="#1e2a24"/>
      <rect x="35" y="18" width="30" height="3.5" fill="#8a2f3a"/>
      <path d="M63 19C71 7 81 2 90 0c-4 9-12 17-24 21z" fill="#f2ecd8" stroke="#b9b09a" stroke-width="1"/>
      <path d="M66 19l18-15" stroke="#b9b09a" stroke-width="1"/>
      <path d="M41 39q3-2.5 6 0M53 39q3-2.5 6 0" stroke="#1f1a17" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M40 51c3-4 7-4 10-2 3-2 7-2 10 2-4-1-7 1-10 1s-6-2-10-1z" fill="#2a1f18"/>
      <path d="M46 56q6 2 9-2" stroke="#6b3a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>` },
    // Old Gale, The Grinder: bald dome, white side tufts, long white beard, round spectacles, cardigan.
    gale: { bg: "#8c97a6", draw: `
      <path d="M14 100c3-20 17-30 36-30s33 10 36 30z" fill="#5b5148"/>
      <path d="M44 70h12l-2 30h-8z" fill="#7a6e62"/>
      <ellipse cx="50" cy="40" rx="18" ry="21" fill="#e0b99a"/>
      <ellipse cx="32" cy="40" rx="5" ry="8" fill="#e8e8e8"/><ellipse cx="68" cy="40" rx="5" ry="8" fill="#e8e8e8"/>
      <path d="M40 26q10-3 20 0" stroke="#c99f82" stroke-width="1.2" fill="none"/>
      <path d="M34 46c0 22 8 38 16 42 8-4 16-20 16-42-6 8-10 10-16 10s-10-2-16-10z" fill="#eeeeee"/>
      <path d="M38 34q5-3 9 0M53 34q5-3 9 0" stroke="#f4f4f4" stroke-width="3" fill="none" stroke-linecap="round"/>
      <g fill="none" stroke="#333" stroke-width="1.8"><circle cx="43" cy="40" r="5.5"/><circle cx="57" cy="40" r="5.5"/><path d="M48.5 40h3"/></g>
      <circle cx="43" cy="40" r="1.5" fill="#222"/><circle cx="57" cy="40" r="1.5" fill="#222"/>
      <path d="M44 52q6 2 12 0" stroke="#b9b9b9" stroke-width="1.6" fill="none"/>` },
    // Marlow, The Theorist: neat side part, rectangular glasses, bow tie, waistcoat.
    marlow: { bg: "#8a7a9a", draw: `
      <path d="M14 100c3-21 17-31 36-31s33 10 36 31z" fill="#41384d"/>
      <path d="M40 69h20l-10 31z" fill="#f0ece4"/>
      <path d="M41 72l9 4-9 4zM59 72l-9 4 9 4z" fill="#a8343f"/><circle cx="50" cy="76" r="2" fill="#7c2630"/>
      <rect x="44" y="55" width="12" height="15" rx="4" fill="#e6bf9c"/>
      <ellipse cx="50" cy="42" rx="17" ry="20" fill="#e6bf9c"/>
      <path d="M32 40c-1-16 8-24 19-24s19 7 18 22c-6-7-14-11-26-10l-2 6c-3 1-6 3-9 6z" fill="#5a3b26"/>
      <g fill="none" stroke="#222" stroke-width="1.8"><rect x="37" y="37" width="11" height="8" rx="1.5"/><rect x="52" y="37" width="11" height="8" rx="1.5"/><path d="M48 41h4"/></g>
      <circle cx="42.5" cy="41" r="1.5" fill="#222"/><circle cx="57.5" cy="41" r="1.5" fill="#222"/>
      <path d="M45 52q5 2 10 0" stroke="#7a4a35" stroke-width="1.6" fill="none" stroke-linecap="round"/>` },
    // Vesper, The Strategist: deep hood, face in shadow, two calm gold eyes, cloak clasp.
    vesper: { bg: "#a08a5a", draw: `
      <path d="M10 100c2-26 10-50 40-84 30 34 38 58 40 84z" fill="#2c2a35"/>
      <path d="M22 100c4-18 14-28 28-28s24 10 28 28z" fill="#3a3746"/>
      <ellipse cx="50" cy="48" rx="15" ry="19" fill="#c79a74"/>
      <path d="M35 46c0-14 7-24 15-28 8 4 15 14 15 28-4-6-9-9-15-9s-11 3-15 9z" fill="#1d1b24"/>
      <ellipse cx="44" cy="49" rx="2.4" ry="1.6" fill="#e2b84a"/><ellipse cx="56" cy="49" rx="2.4" ry="1.6" fill="#e2b84a"/>
      <path d="M46 59h8" stroke="#6b4a35" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="50" cy="80" r="4" fill="#e2b84a"/><circle cx="50" cy="80" r="1.6" fill="#8a6a2a"/>` }
  };
  function svg(id, size, extra) {
    const a = ART[id];
    const s = size || 72;
    if (!a) return "";
    return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" class="rival-art rival-portrait" data-testid="rival-portrait" data-rival="${id}" role="img" aria-label="Portrait"${extra || ""}><clipPath id="rp-${id}-${s}"><circle cx="50" cy="50" r="48"/></clipPath><circle cx="50" cy="50" r="48" fill="${a.bg}"/><g clip-path="url(#rp-${id}-${s})">${a.draw}</g><circle cx="50" cy="50" r="47" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/></svg>`;
  }
  window.Portraits = { svg, ids: Object.keys(ART) };
})();
