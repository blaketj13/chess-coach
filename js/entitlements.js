/* Entitlement scaffold (1.6.0). Flags only: EVERYTHING IS UNLOCKED in 1.6.0.
   No paywall, trial, billing or store products here; those land in 1.7.0.
   One declarative table. Each feature has a tier: "free" or "pro".
   The gate reads it through window.__qa.entitlement. */
(function () {
  const ENFORCE = false; // 1.6.0: never lock anything. 1.7.0 flips this behind billing.

  const FEATURES = [
    // FREE
    { id: "placement", tier: "free", label: "Placement games and your rating" },
    { id: "rating", tier: "free", label: "Rating estimate and confidence band" },
    { id: "daily-set", tier: "free", label: "Today's daily set" },
    { id: "own-game-why", tier: "free", label: "Why-breakdown on every mistake in your own games" },
    { id: "adventure-free-regions", tier: "free", label: "First two adventure regions from your entry point, rivals included", rule: "freeRegions" },
    { id: "adventure-passed-regions", tier: "free", label: "Earlier regions, shown as Passed", rule: "passedRegions" },
    { id: "lessons-library", tier: "free", label: "Full lessons library in Train" },
    { id: "no-ads", tier: "free", label: "No ads, ever" },
    // PRO
    { id: "own-game-drills-unlimited", tier: "pro", label: "Unlimited own-game drills" },
    { id: "openings-unlimited", tier: "pro", label: "Unlimited opening work" },
    { id: "adventure-full", tier: "pro", label: "Full journey beyond the free regions", rule: "proRegions" },
    { id: "rival-rematch", tier: "pro", label: "Rival rematches" },
    { id: "seasonal-events", tier: "pro", label: "Seasonal events" },
    { id: "maia-bots", tier: "pro", label: "Humanlike (Maia) rivals and bosses" },
    { id: "move-alternatives", tier: "pro", label: "Alternative moves on every move" },
    { id: "go-deeper", tier: "pro", label: "'Go deeper' lines on every move" },
    { id: "rush-unlimited", tier: "pro", label: "Unlimited Rush" },
    { id: "weekly-sets", tier: "pro", label: "Weekly puzzle sets" },
    { id: "journey-card", tier: "pro", label: "Shareable journey card" },
    { id: "badges-unlimited", tier: "pro", label: "Unlimited linked-game badges" },
    { id: "weekly-recap", tier: "pro", label: "Weekly recap" }
  ];
  // Path order. Placeholder regions (no content yet) are skipped when counting.
  const REGION_ORDER = ["village", "cliffs", "tower", "forest", "crossroads", "peaks"];
  const PLACEHOLDER = { crossroads: true };
  const STORE_KEY = "sc.entitlement";

  function plan() {
    try { return localStorage.getItem(STORE_KEY) === "pro" ? "pro" : "free"; } catch (e) { return "free"; }
  }
  function startRegion() {
    try { const s = window.__qa && window.__qa.adventureStart; if (s && s.region) return s.region; } catch (e) {}
    return "village";
  }
  /** Free = the entry region plus the next real region. Earlier ones are Passed (also free). */
  function regionTiers(entry) {
    const real = REGION_ORDER.filter((r) => !PLACEHOLDER[r]);
    const i = Math.max(0, real.indexOf(entry || startRegion()));
    const out = {};
    real.forEach((r, j) => { out[r] = j < i ? "passed" : j <= i + 1 ? "free" : "pro"; });
    return out;
  }
  function freeRegions(entry) { const t = regionTiers(entry); return Object.keys(t).filter((r) => t[r] === "free"); }
  function feature(id) { return FEATURES.find((f) => f.id === id) || null; }
  /** What the plan WOULD allow. Informational in 1.6.0. */
  function wouldAllow(id, opts) {
    const f = feature(id);
    if (!f) return true;
    if (id === "adventure-full" && opts && opts.region) return regionTiers(opts.entry)[opts.region] !== "pro" || plan() === "pro";
    return f.tier === "free" || plan() === "pro";
  }
  /** What the app actually enforces. Always true in 1.6.0. */
  function allowed(id, opts) { return ENFORCE ? wouldAllow(id, opts) : true; }
  function regionTier(region, entry) { return regionTiers(entry)[region] || "pro"; }

  const api = { FEATURES, REGION_ORDER, ENFORCE, plan, feature, allowed, wouldAllow, regionTiers, regionTier, freeRegions,
    table() { return FEATURES.map((f) => ({ id: f.id, tier: f.tier, label: f.label, rule: f.rule || null, unlocked: allowed(f.id) })); } };
  window.Entitlements = api;
  window.__qa = window.__qa || {};
  window.__qa.entitlement = api;
})();
