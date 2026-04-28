import * as React from "react";
import katex from "katex";
import { cn } from "@/lib/utils";

export function FormulaBlock({
  formula,
  caption,
  className,
  children,
}: {
  /** TeX source. Either pass `formula` or place TeX between tags as `children`. */
  formula?: string;
  caption?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const tex =
    formula ?? (typeof children === "string" ? children : String(children ?? ""));

  let html = "";
  try {
    html = katex.renderToString(tex, {
      displayMode: true,
      throwOnError: false,
      strict: "ignore",
      trust: false,
    });
  } catch {
    html = `<pre>${tex}</pre>`;
  }

  return (
    <figure className={cn("my-8 not-prose", className)}>
      <div
        className="border-l-2 border-steel/70 bg-secondary/60 px-6 py-5 overflow-x-auto rounded-r-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {caption && (
        <figcaption className="mt-2 px-1 text-xs text-muted-foreground italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
