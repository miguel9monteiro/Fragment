import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ModuleEntry } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

export function ModuleNav({
  prev,
  next,
}: {
  prev: ModuleEntry | null;
  next: ModuleEntry | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav
      className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2"
      aria-label="Module pagination"
    >
      {prev ? (
        <Link
          href={`/modules/${prev.category}/${prev.slug}`}
          className="group flex flex-col gap-2 border border-border p-5 hover:bg-secondary/60 transition-colors"
        >
          <span className="eyebrow inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3 w-3" /> Previous
          </span>
          <span className="font-serif text-base font-semibold tracking-tight">
            {prev.frontmatter.title}
          </span>
          <span className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[prev.category]}
          </span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/modules/${next.category}/${next.slug}`}
          className="group flex flex-col gap-2 border border-border p-5 text-right hover:bg-secondary/60 transition-colors"
        >
          <span className="eyebrow inline-flex items-center gap-1.5 self-end">
            Next <ArrowRight className="h-3 w-3" />
          </span>
          <span className="font-serif text-base font-semibold tracking-tight">
            {next.frontmatter.title}
          </span>
          <span className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[next.category]}
          </span>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
