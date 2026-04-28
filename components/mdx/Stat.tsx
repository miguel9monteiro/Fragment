import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A row of large stat callouts — used for "the numbers that matter"
 * moments. Children are <Stat> elements.
 *
 *   <Stats>
 *     <Stat value="20–30%" label="Target IRR" />
 *     <Stat value="2.0–2.5x" label="Target MOIC" />
 *     <Stat value="3–7y" label="Hold period" />
 *   </Stats>
 */
export function Stats({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "not-prose my-10 grid gap-px bg-border border border-border sm:grid-cols-2 md:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  value,
  label,
  caption,
}: {
  value: string;
  label: string;
  caption?: string;
}) {
  return (
    <div className="bg-card p-6 flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-steel">
        {label}
      </p>
      <p className="font-bold text-4xl tnum tracking-tight leading-none text-primary">
        {value}
      </p>
      {caption && (
        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
          {caption}
        </p>
      )}
    </div>
  );
}

/**
 * A single large stat — for moments where ONE number deserves the
 * full visual stage.
 */
export function BigStat({
  value,
  label,
  caption,
  className,
}: {
  value: string;
  label: string;
  caption?: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "not-prose my-12 flex flex-col items-center text-center gap-3 py-10 px-6 bg-secondary/60 border-y border-border",
        className,
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-steel">
        {label}
      </p>
      <p className="font-bold text-6xl sm:text-7xl tnum tracking-tight leading-none text-primary">
        {value}
      </p>
      {caption && (
        <figcaption className="text-sm text-muted-foreground leading-relaxed max-w-md mt-2">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
