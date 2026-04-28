import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProsCons({
  pros,
  cons,
  prosLabel = "Catalysts",
  consLabel = "Risks",
  className,
}: {
  pros: string[];
  cons: string[];
  prosLabel?: string;
  consLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("not-prose my-8 grid gap-4 md:grid-cols-2", className)}>
      <div className="border border-border bg-success/[0.03] p-5 rounded-sm">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-success" />
          <p className="eyebrow text-success">{prosLabel}</p>
        </div>
        <ul className="space-y-2.5 text-[0.95em] leading-relaxed">
          {pros.map((p, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 rounded-full bg-success shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border border-border bg-destructive/[0.03] p-5 rounded-sm">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="h-4 w-4 text-destructive" />
          <p className="eyebrow text-destructive">{consLabel}</p>
        </div>
        <ul className="space-y-2.5 text-[0.95em] leading-relaxed">
          {cons.map((c, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 rounded-full bg-destructive shrink-0" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
