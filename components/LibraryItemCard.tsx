import Link from "next/link";
import { ArrowUpRight, Clock, Calendar, Globe } from "lucide-react";
import type { LibraryEntry } from "@/lib/types";
import { LIBRARY_META } from "@/lib/types";
import { DifficultyBadge } from "./DifficultyBadge";
import { formatDate, cn } from "@/lib/utils";

export function LibraryItemCard({
  item,
  className,
}: {
  item: LibraryEntry;
  className?: string;
}) {
  const meta = LIBRARY_META[item.kind];
  const fm = item.frontmatter;

  return (
    <Link
      href={`${meta.route}/${item.slug}`}
      className={cn(
        "group flex flex-col h-full border border-border bg-card p-6 transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <span className="eyebrow-accent">{meta.singular}</span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
      </div>

      <h3 className="text-lg font-semibold tracking-tight leading-snug mb-3">
        {fm.title}
      </h3>

      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-5">
        {fm.summary}
      </p>

      {fm.tags && fm.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-5">
          {fm.tags.slice(0, 4).map((t) => (
            <li
              key={t}
              className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded-sm px-1.5 py-0.5"
            >
              {t}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-border/70">
        {item.kind === "macro" ? (
          <MacroMeta period={item.frontmatter.period} region={item.frontmatter.region} />
        ) : (
          <DifficultyBadge difficulty={item.frontmatter.difficulty} />
        )}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {item.kind !== "macro" && (
            <span className="inline-flex items-center gap-1 tnum">
              <Clock className="h-3 w-3" />
              {item.frontmatter.estimatedReadTime} min
            </span>
          )}
          <span className="inline-flex items-center gap-1 tnum">
            <Calendar className="h-3 w-3" />
            {formatDate(fm.date)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function MacroMeta({ period, region }: { period: string; region?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[11px]">
      <span className="inline-flex items-center rounded-sm border border-steel/30 bg-steel/10 text-steel px-2 py-0.5 font-semibold uppercase tracking-wider">
        {period}
      </span>
      {region && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Globe className="h-3 w-3" />
          {region}
        </span>
      )}
    </span>
  );
}
