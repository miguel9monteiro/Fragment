import * as React from "react";
import { cn } from "@/lib/utils";
import type { OptionKind, PollOption } from "@/lib/types";

/**
 * Map an option's semantic role to a colour. Buy is green, sell is
 * red, hold is a neutral gray, increase is steel, abstain is muted.
 * The mapping is deliberately consistent across all polls so members
 * can read the bar without checking the legend each time.
 */
const KIND_BG: Record<OptionKind, string> = {
  buy: "bg-success",
  sell: "bg-destructive",
  hold: "bg-foreground/35",
  increase: "bg-steel",
  abstain: "bg-foreground/12",
};

const KIND_DOT: Record<OptionKind, string> = {
  buy: "bg-success",
  sell: "bg-destructive",
  hold: "bg-foreground/35",
  increase: "bg-steel",
  abstain: "bg-foreground/25",
};

const KIND_TEXT: Record<OptionKind, string> = {
  buy: "text-success",
  sell: "text-destructive",
  hold: "text-foreground/75",
  increase: "text-steel",
  abstain: "text-muted-foreground",
};

export function kindColors(kind: OptionKind) {
  return { bg: KIND_BG[kind], dot: KIND_DOT[kind], text: KIND_TEXT[kind] };
}

/**
 * Proportional stacked horizontal bar. Empty (zero-count) options
 * collapse so the bar reads cleanly even on landslides like 32-0-2.
 */
export function VoteBar({
  options,
  height = "h-2.5",
  className,
}: {
  options: PollOption[];
  height?: string;
  className?: string;
}) {
  const total = options.reduce((s, o) => s + o.count, 0);
  if (total === 0) return null;
  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-sm border border-border",
        height,
        className,
      )}
    >
      {options.map((o, i) =>
        o.count === 0 ? null : (
          <div
            key={`${o.label}-${i}`}
            className={cn(
              "h-full",
              KIND_BG[o.kind],
              i > 0 && "border-l border-background/60",
            )}
            style={{ flex: o.count }}
            aria-label={`${o.label}: ${o.count} votes`}
          />
        ),
      )}
    </div>
  );
}

/** A row of small "Buy 18 · Don't buy 11 · No opinion 7" labels with colour dots. */
export function VoteLegend({
  options,
  className,
}: {
  options: PollOption[];
  className?: string;
}) {
  const total = options.reduce((s, o) => s + o.count, 0);
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]",
        className,
      )}
    >
      {options.map((o, i) => {
        const pct = total > 0 ? Math.round((o.count / total) * 100) : 0;
        return (
          <li
            key={`${o.label}-${i}`}
            className="inline-flex items-center gap-1.5"
          >
            <span
              className={cn("h-2 w-2 rounded-sm shrink-0", KIND_DOT[o.kind])}
              aria-hidden
            />
            <span className="text-foreground/85">{o.label}</span>
            <span className="tnum text-muted-foreground">
              {o.count}
              <span className="ml-0.5">·</span>
              <span className="ml-0.5">{pct}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
