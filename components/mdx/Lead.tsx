import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pull-quote / lead block — used for the magazine-style emphasised
 * sentence at the start or middle of a long-form piece. Looks like a
 * statement, not a paragraph.
 */
export function PullQuote({
  children,
  attribution,
  className,
}: {
  children: React.ReactNode;
  attribution?: string;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "not-prose my-12 max-w-2xl mx-auto px-4 sm:px-8 text-center",
        className,
      )}
    >
      <blockquote className="text-2xl sm:text-3xl font-semibold leading-[1.3] tracking-tight text-primary text-balance">
        <span className="text-steel mr-1">“</span>
        {children}
        <span className="text-steel ml-1">”</span>
      </blockquote>
      {attribution && (
        <figcaption className="mt-4 text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
          {attribution}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * A horizontal rule with a small steel diamond in the middle — used as
 * a visual section break that's stronger than &lt;hr&gt; but lighter
 * than starting a new H2.
 */
export function Divider() {
  return (
    <div className="not-prose my-14 flex items-center justify-center gap-4">
      <span className="h-px flex-1 bg-border" />
      <span className="text-steel text-xs tracking-[0.3em]">◆</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
