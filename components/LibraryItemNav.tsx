import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { LibraryEntry } from "@/lib/types";
import { LIBRARY_META } from "@/lib/types";

export function LibraryItemNav({
  prev,
  next,
}: {
  prev: LibraryEntry | null;
  next: LibraryEntry | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav
      className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2"
      aria-label="Adjacent items"
    >
      {prev ? (
        <Link
          href={`${LIBRARY_META[prev.kind].route}/${prev.slug}`}
          className="group flex flex-col gap-2 border border-border p-5 hover:bg-secondary/60 transition-colors"
        >
          <span className="eyebrow inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3 w-3" /> Previous
          </span>
          <span className="text-base font-semibold tracking-tight">
            {prev.frontmatter.title}
          </span>
          <span className="text-xs text-muted-foreground">
            {LIBRARY_META[prev.kind].singular}
          </span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`${LIBRARY_META[next.kind].route}/${next.slug}`}
          className="group flex flex-col gap-2 border border-border p-5 text-right hover:bg-secondary/60 transition-colors"
        >
          <span className="eyebrow inline-flex items-center gap-1.5 self-end">
            Next <ArrowRight className="h-3 w-3" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            {next.frontmatter.title}
          </span>
          <span className="text-xs text-muted-foreground">
            {LIBRARY_META[next.kind].singular}
          </span>
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
