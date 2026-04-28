"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, LayoutGrid, List, Clock, ArrowUpRight } from "lucide-react";
import type {
  ArticleFrontmatter,
  MacroFrontmatter,
  Difficulty,
} from "@/lib/types";
import { DIFFICULTIES, LIBRARY_META } from "@/lib/types";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { LibraryItemCard } from "@/components/LibraryItemCard";
import { cn, formatDate } from "@/lib/utils";

export type ClientLibraryEntry =
  | {
      kind: "session" | "quant";
      slug: string;
      frontmatter: ArticleFrontmatter;
    }
  | {
      kind: "macro";
      slug: string;
      frontmatter: MacroFrontmatter;
    };

export function LibraryIndex({
  kind,
  items,
}: {
  kind: "session" | "macro" | "quant";
  items: ClientLibraryEntry[];
}) {
  const meta = LIBRARY_META[kind];
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get("q") || "";
  const initialTag = searchParams.get("tag") || "all";
  const initialDifficulty =
    (searchParams.get("difficulty") as Difficulty) || "all";
  const initialView = (searchParams.get("view") as "grid" | "list") || "grid";

  const [query, setQuery] = useState(initialQuery);
  const [tag, setTag] = useState<string>(initialTag);
  const [difficulty, setDifficulty] = useState<Difficulty | "all">(
    initialDifficulty,
  );
  const [view, setView] = useState<"grid" | "list">(initialView);

  // All tags present, sorted by frequency descending
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const t of item.frontmatter.tags) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [items]);

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (tag !== "all") params.set("tag", tag);
    if (difficulty !== "all") params.set("difficulty", difficulty);
    if (view !== "grid") params.set("view", view);
    const qs = params.toString();
    router.replace(qs ? `${meta.route}?${qs}` : meta.route, { scroll: false });
  }, [query, tag, difficulty, view, router, meta.route]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter((item) => {
      if (tag !== "all" && !item.frontmatter.tags.includes(tag)) return false;
      if (
        difficulty !== "all" &&
        item.kind !== "macro" &&
        item.frontmatter.difficulty !== difficulty
      )
        return false;
      if (!q) return true;
      const haystack =
        `${item.frontmatter.title} ${item.frontmatter.summary} ${item.frontmatter.tags.join(" ")} ${item.frontmatter.author}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query, tag, difficulty]);

  const hasMacro = kind === "macro";
  const showDifficultyFilter = !hasMacro;

  return (
    <>
      <section className="container pt-12 pb-10 border-b border-border">
        <p className="eyebrow-accent mb-3">Library</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          {meta.label}
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
          {meta.description}
        </p>
      </section>

      {/* Filters */}
      <section className="sticky top-16 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="container py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <label className="relative flex-1 min-w-0 lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, tag, author…"
              className="w-full h-9 pl-9 pr-9 rounded-sm border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>

          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 flex-1 overflow-x-auto">
              <Chip active={tag === "all"} onClick={() => setTag("all")}>
                All tags
              </Chip>
              {allTags.map((t) => (
                <Chip key={t} active={tag === t} onClick={() => setTag(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          )}

          {showDifficultyFilter && (
            <div className="flex items-center gap-1.5">
              <Chip
                active={difficulty === "all"}
                onClick={() => setDifficulty("all")}
              >
                Any level
              </Chip>
              {DIFFICULTIES.map((d) => (
                <Chip
                  key={d}
                  active={difficulty === d}
                  onClick={() => setDifficulty(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </Chip>
              ))}
            </div>
          )}

          <div className="hidden lg:flex items-center border border-border rounded-sm">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              className={cn(
                "h-8 w-8 grid place-items-center transition-colors",
                view === "grid"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
              className={cn(
                "h-8 w-8 grid place-items-center border-l border-border transition-colors",
                view === "list"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="container py-12">
        {items.length === 0 ? (
          <div className="border border-dashed border-border py-20 text-center rounded-sm">
            <p className="text-xl font-semibold mb-2">
              No {meta.label.toLowerCase()} yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Add an MDX file under{" "}
              <code className="text-xs">/content/{meta.dir}/</code>.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border py-20 text-center rounded-sm">
            <p className="text-xl font-semibold mb-2">No matches.</p>
            <p className="text-sm text-muted-foreground">
              Try clearing filters or broaden your search.
            </p>
          </div>
        ) : view === "list" ? (
          <ListView items={filtered} />
        ) : (
          <div className="grid gap-px bg-border border border-border md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <LibraryItemCard
                key={`${m.kind}-${m.slug}`}
                item={m as never}
                className="border-0"
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 px-3 rounded-sm border text-[12px] font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border bg-background text-foreground/80 hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function ListView({ items }: { items: ClientLibraryEntry[] }) {
  return (
    <ol className="border border-border divide-y divide-border">
      {items.map((m) => {
        const meta = LIBRARY_META[m.kind];
        return (
          <li key={`${m.kind}-${m.slug}`}>
            <Link
              href={`${meta.route}/${m.slug}`}
              className="group flex items-center gap-6 px-5 py-4 hover:bg-secondary/50 transition-colors"
            >
              <span className="hidden md:block w-32 shrink-0">
                <span className="eyebrow-accent">{meta.singular}</span>
              </span>
              <span className="flex-1 min-w-0">
                <p className="text-base font-semibold tracking-tight truncate">
                  {m.frontmatter.title}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {m.frontmatter.summary}
                </p>
              </span>
              {m.kind !== "macro" && (
                <span className="hidden sm:inline-flex">
                  <DifficultyBadge difficulty={m.frontmatter.difficulty} />
                </span>
              )}
              <span className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground tnum">
                {m.kind !== "macro" ? (
                  <>
                    <Clock className="h-3 w-3" />
                    {m.frontmatter.estimatedReadTime}m
                  </>
                ) : (
                  <span className="inline-flex items-center rounded-sm border border-steel/30 bg-steel/10 text-steel px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    {m.frontmatter.period}
                  </span>
                )}
              </span>
              <span className="hidden lg:inline text-xs text-muted-foreground tnum">
                {formatDate(m.frontmatter.date)}
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
