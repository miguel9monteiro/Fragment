import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import type { ModuleEntry } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { DifficultyBadge } from "./DifficultyBadge";
import { cn } from "@/lib/utils";

export function ModuleCard({
  module,
  className,
}: {
  module: ModuleEntry;
  className?: string;
}) {
  const { frontmatter, slug, category } = module;
  return (
    <Link
      href={`/modules/${category}/${slug}`}
      className={cn(
        "group flex flex-col h-full border border-border bg-card p-6 transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <span className="eyebrow-gold">{CATEGORY_LABELS[category]}</span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
      </div>

      <h3 className="font-serif text-lg font-semibold tracking-tight leading-snug mb-3">
        {frontmatter.title}
      </h3>

      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-5">
        {frontmatter.summary}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-border/70">
        <DifficultyBadge difficulty={frontmatter.difficulty} />
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 tnum">
            <Clock className="h-3 w-3" />
            {frontmatter.estimatedReadTime} min
          </span>
        </div>
      </div>
    </Link>
  );
}
