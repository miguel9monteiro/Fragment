/**
 * Ambient backdrop for the home-page hero.
 *
 * Three layered elements:
 *  1. A faint institutional grid (data-terminal underpinning, static).
 *  2. Three drifting gradient orbs in steel + navy (slow depth motion).
 *  3. A periodic scan-line traversing the hero (~18s cycle).
 *
 * Pure CSS via globals.css. Respects prefers-reduced-motion.
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className="hero-backdrop pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="hero-grid absolute inset-0" />
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-orb hero-orb-3" />
      <div className="hero-scan" />
    </div>
  );
}
