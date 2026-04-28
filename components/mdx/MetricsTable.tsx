import * as React from "react";
import { cn } from "@/lib/utils";

type Row = (string | number)[];

export function MetricsTable({
  caption,
  headers,
  rows,
  highlightRow,
  align,
  className,
}: {
  caption?: string;
  headers: string[];
  rows: Row[];
  /** Index of a row to highlight (0-based). Use for the bolded "selected" line. */
  highlightRow?: number;
  /** Per-column alignment override. Defaults: first col left, rest right. */
  align?: ("left" | "right" | "center")[];
  className?: string;
}) {
  const colAlign = (i: number) =>
    align?.[i] ?? (i === 0 ? "text-left" : "text-right");

  return (
    <figure className={cn("my-8 not-prose", className)}>
      <div className="overflow-x-auto border border-border rounded-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              {headers.map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.12em] text-muted-foreground",
                    colAlign(i),
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono tnum">
            {rows.map((row, r) => (
              <tr
                key={r}
                className={cn(
                  "border-b border-border/70 last:border-b-0",
                  highlightRow === r &&
                    "bg-gold/[0.06] [&_td]:font-semibold",
                )}
              >
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={cn(
                      "px-4 py-2.5 text-[13px]",
                      c === 0 && "font-sans",
                      colAlign(c),
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <figcaption className="mt-2 px-1 text-xs text-muted-foreground italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
