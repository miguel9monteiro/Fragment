"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, ArrowUpRight } from "lucide-react";
import type { GlossaryTerm } from "@/lib/types";
import { cn, slugify } from "@/lib/utils";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function GlossaryClient({ terms }: { terms: GlossaryTerm[] }) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? terms.filter(
          (t) =>
            t.term.toLowerCase().includes(q) ||
            (t.fullName ?? "").toLowerCase().includes(q) ||
            t.definition.toLowerCase().includes(q),
        )
      : terms;
    const map = new Map<string, GlossaryTerm[]>();
    for (const t of filtered) {
      const letter = t.term[0].toUpperCase();
      const arr = map.get(letter) ?? [];
      arr.push(t);
      map.set(letter, arr);
    }
    return map;
  }, [terms, query]);

  const presentLetters = new Set(grouped.keys());

  return (
    <>
      <section className="container pt-12 pb-10 border-b border-border">
        <p className="eyebrow-accent mb-3">Library</p>
        <h1 className="font-bold text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
          Glossary
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
          A shared vocabulary for the club. Every term links to the sessions,
          pitches, and quant work that explore it.
        </p>
      </section>

      {/* Filters / jump nav */}
      <section className="sticky top-16 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="container py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <label className="relative flex-1 lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search definitions…"
              className="w-full h-9 pl-9 pr-9 rounded-sm border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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

          <nav
            className="flex items-center gap-0 overflow-x-auto"
            aria-label="Jump to letter"
          >
            {ALPHABET.map((l) => (
              <a
                key={l}
                href={`#letter-${l}`}
                aria-disabled={!presentLetters.has(l)}
                className={cn(
                  "h-7 w-7 grid place-items-center text-[11px] tnum rounded-sm transition-colors",
                  presentLetters.has(l)
                    ? "text-foreground hover:bg-secondary"
                    : "text-muted-foreground/40 pointer-events-none",
                )}
              >
                {l}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* Terms */}
      <section className="container py-14">
        {grouped.size === 0 ? (
          <div className="border border-dashed border-border py-20 text-center rounded-sm">
            <p className="text-xl font-semibold mb-2">
              No matches.
            </p>
            <p className="text-sm text-muted-foreground">
              Try a different keyword.
            </p>
          </div>
        ) : (
          <div className="space-y-14">
            {[...grouped.entries()].map(([letter, items]) => (
              <div key={letter} id={`letter-${letter}`}>
                <h2 className="text-3xl font-semibold tracking-tight mb-5 pb-2 border-b border-border">
                  <span className="text-steel">{letter}</span>
                </h2>
                <dl className="grid gap-px bg-border border border-border md:grid-cols-2">
                  {items.map((t) => (
                    <div
                      key={t.term}
                      id={slugify(t.term)}
                      className="bg-card p-5 scroll-mt-32"
                    >
                      <dt className="flex items-baseline gap-2 mb-2">
                        <span className="text-lg font-semibold tracking-tight">
                          {t.term}
                        </span>
                        {t.fullName && (
                          <span className="text-xs text-muted-foreground italic">
                            {t.fullName}
                          </span>
                        )}
                      </dt>
                      <dd>
                        <p className="text-sm leading-relaxed text-foreground/85">
                          {t.definition}
                        </p>
                        {t.relatedItems && t.relatedItems.length > 0 && (
                          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                            {t.relatedItems.map((slug) => (
                              <li key={slug}>
                                <Link
                                  href={`/sessions?q=${encodeURIComponent(slug)}`}
                                  className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-steel hover:underline"
                                >
                                  <ArrowUpRight className="h-3 w-3" />
                                  {slug.replace(/-/g, " ")}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
