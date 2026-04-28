import { HeroShader } from "./HeroShader";

/**
 * Ambient backdrop for the home-page hero. Layers, bottom to top:
 *
 *  1. WebGL2 mesh-gradient shader (HeroShader) — the cinematic layer.
 *     Falls back to the CSS orbs below it if WebGL2 is unsupported.
 *  2. CSS orbs — subtle additional depth and a fallback for legacy
 *     browsers.
 *  3. Faint institutional grid (mask-faded at edges).
 *  4. Periodic hairline scan line traversing the hero on a long cycle.
 *
 * All elements respect prefers-reduced-motion.
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className="hero-backdrop pointer-events-none absolute inset-0 overflow-hidden"
    >
      <HeroShader />
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-orb hero-orb-3" />
      <div className="hero-grid absolute inset-0" />
      <div className="hero-scan" />
    </div>
  );
}
