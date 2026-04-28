import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A multi-column visual layout for "concept" moments — a grid of cards
 * where each card has an eyebrow label, a title, and supporting prose.
 *
 *   <Pillars>
 *     <Pillar eyebrow="Strategy" title="Operational change">
 *       Improve the business through strategic operational changes.
 *     </Pillar>
 *     <Pillar eyebrow="Capital" title="Leverage and equity">
 *       Drive above-average returns by leveraging capital and debt.
 *     </Pillar>
 *   </Pillars>
 *
 * The layout adapts: 1 col on mobile, 2 cols on tablet, up to 4 on
 * desktop based on child count.
 */
export function Pillars({
  children,
  className,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  /** "default" = light cards, "primary" = navy hero feel */
  variant?: "default" | "primary";
}) {
  const count = React.Children.count(children);
  const cols =
    count === 2
      ? "md:grid-cols-2"
      : count === 3
        ? "md:grid-cols-3"
        : count === 4
          ? "sm:grid-cols-2 lg:grid-cols-4"
          : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <div
      className={cn(
        "not-prose my-10 grid gap-px bg-border border border-border",
        cols,
        variant === "primary" && "bg-primary/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Pillar({
  eyebrow,
  title,
  children,
  emphasize = false,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  /** Highlights this card with a steel accent. */
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-6 flex flex-col gap-3",
        emphasize ? "bg-steel/[0.06]" : "bg-card",
      )}
    >
      {eyebrow && (
        <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-steel">
          {eyebrow}
        </p>
      )}
      <p className="font-bold text-lg tracking-tight leading-snug text-primary">
        {title}
      </p>
      <div className="text-sm leading-relaxed text-foreground/85 [&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}
