"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, LayoutGrid, List, Clock, ArrowUpRight } from "lucide-react";
import {
  CATEGORY_LABELS,
  DIFFICULTIES,
  MODULE_CATEGORIES,
  type Difficulty,
  type ModuleCategory,
  type ModuleFrontmatter,
} from "@/lib/types";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { ModuleCard } from "@/components/ModuleCard";
import { cn } from "@/lib/utils";

type ModuleEntry = {
  slug: string;
  category: ModuleCategory;
  frontmatter: ModuleFrontmatter;
};

export function ModulesIndex({ modules }: { modules: ModuleEntry[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialCategory =
    (searchParams.get("category") as ModuleCategory) || "all";
  const initialDifficulty =
    (searchParams.get("difficulty") as Difficulty) || "all";
  const initialQuery = searchParams.get("q") || "";
  const initialView = (searchParams.get("view") as "grid" | "list") || "grid";

  const [category, setCategory] = useState<ModuleCategory | "all">(
    initialCategory,
  );
  const [difficulty, setDifficulty] = useState<Difficulty | "all">(
    initialDifficulty,
  );
  const [query, setQuery] = useState(initialQuery);
  const [view, setView] = useState<"grid" | "list">(initialView);

  // Sync URL with current filters (without scroll/jank)
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (difficulty !== "all") params.set("difficulty", difficulty);
    if (query) params.set("q", query);
    if (view !== "grid") params.set("view", view);
    const qs = params.toString();
    router.replace(qs ? `/modules?${qs}` : "/modules", { scroll: false });
  }, [category, difficulty, query, view, router]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return modules.filter((m) => {
      if (category !== "all" && m.category !== category) return false;
      if (difficulty !== "all" && m.frontmatter.difficulty !== difficulty)
        return false;
      if (!q) return true;
      const haystack =
        `${m.frontmatter.title} ${m.frontmatter.summary} ${m.frontmatter.tags.join(" ")} ${m.frontmatter.author}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [modules, category, difficulty, query]);

  const grouped = useMemo(() => {
    const map = new Map<ModuleCategory, ModuleEntry[]>();
    for (const m of filtered) {
      const arr = map.get(m.category) ?? [];
      arr.push(m);
      map.set(m.category, arr);
    }
    return map;
  }, [filtered]);

  const filtersActive =
    category !== "all" || difficulty !== "all" || query.length > 0;

  return (
    <>
      {/* Page heading */}
      <section className="container pt-12 pb-10 border-b border-border">
        <p className="eyebrow-gold mb-3">Library</p>
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
          Modules
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
          {modules.length} module{modules.length === 1 ? "" : "s"} across{" "}
          {MODULE_CATEGORIES.length} disciplines. Filter by topic, difficulty, or
          search by keyword.
        </p>
      </section>

      {/* Filter bar */}
      <section className="sticky top-16 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="container py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          {/* Search */}
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

          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 overflow-x-auto">
            <Chip
              active={category === "all"}
              onClick={() => setCategory("all")}
            >
              All topics
            </Chip>
            {MODULE_CATEGORIES.map((c) => (
              <Chip
                key={c}
                active={category === c}
                onClick={() => setCategory(c)}
              >
                {CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>

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
        {filtered.length === 0 ? (
          <div className="border border-dashed border-border py-20 text-center rounded-sm">
            <p className="font-serif text-xl font-semibold mb-2">
              No matches yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Try clearing filters or broaden your search.
            </p>
          </div>
        ) : view === "list" ? (
          <ListView modules={filtered} />
        ) : filtersActive ? (
          <div className="grid gap-px bg-border border border-border md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <ModuleCard
                key={`${m.category}-${m.slug}`}
                module={m as never}
                className="border-0"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-16">
            {[...grouped.entries()].map(([cat, mods]) => (
              <div key={cat}>
                <div className="flex items-end justify-between mb-6 pb-3 border-b border-border">
                  <div>
                    <p className="eyebrow-gold mb-1">Category</p>
                    <h2 className="font-serif text-2xl font-semibold tracking-tight">
                      {CATEGORY_LABELS[cat]}
                    </h2>
                  </div>
                  <span className="text-xs text-muted-foreground tnum">
                    {mods.length} module{mods.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid gap-px bg-border border border-border md:grid-cols-2 lg:grid-cols-3">
                  {mods.map((m) => (
                    <ModuleCard
                      key={`${m.category}-${m.slug}`}
                      module={m as never}
                      className="border-0"
                    />
                  ))}
                </div>
              </div>
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

function ListView({ modules }: { modules: ModuleEntry[] }) {
  return (
    <ol className="border border-border divide-y divide-border">
      {modules.map((m) => (
        <li key={`${m.category}-${m.slug}`}>
          <Link
            href={`/modules/${m.category}/${m.slug}`}
            className="group flex items-center gap-6 px-5 py-4 hover:bg-secondary/50 transition-colors"
          >
            <span className="hidden md:block w-32 shrink-0">
              <span className="eyebrow-gold">
                {CATEGORY_LABELS[m.category]}
              </span>
            </span>
            <span className="flex-1 min-w-0">
              <p className="font-serif text-base font-semibold tracking-tight truncate">
                {m.frontmatter.title}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {m.frontmatter.summary}
              </p>
            </span>
            <span className="hidden sm:inline-flex">
              <DifficultyBadge difficulty={m.frontmatter.difficulty} />
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground tnum">
              <Clock className="h-3 w-3" />
              {m.frontmatter.estimatedReadTime}m
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
          </Link>
        </li>
      ))}
    </ol>
  );
}
