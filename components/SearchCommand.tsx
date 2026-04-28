"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search as SearchIcon,
  GraduationCap,
  Globe,
  LineChart,
  FileText,
  Hash,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { search, type SearchableItem } from "@/lib/search";

export function SearchCommand({ items }: { items: SearchableItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => search(items, q), [items, q]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Search the library"
          className="inline-flex items-center gap-2 rounded-sm border border-border bg-secondary/60 px-3 h-9 text-xs text-muted-foreground hover:bg-secondary transition-colors"
        >
          <SearchIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search the library</span>
          <span className="hidden md:inline ml-3 tnum text-[10px] tracking-wider">
            ⌘K
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl p-0 gap-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4 h-12">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            placeholder="Search modules, glossary, tags…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline tnum text-[10px] text-muted-foreground tracking-wider">
            ESC
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {q.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Try <span className="tnum">WACC</span>,{" "}
              <span className="tnum">DCF</span>, or{" "}
              <span className="tnum">Q&amp;A</span>.
            </div>
          )}
          {q.length > 0 && results.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No matches for{" "}
              <span className="tnum text-foreground">{q}</span>.
            </div>
          )}
          {results.length > 0 && (
            <ul className="divide-y divide-border">
              {results.map((r, i) => {
                if (r.kind === "term") {
                  return (
                    <li key={`t-${r.term}-${i}`}>
                      <Link
                        href={r.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/60"
                      >
                        <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">
                            {r.term}
                            {r.fullName && (
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                · {r.fullName}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {r.definition}
                          </p>
                        </div>
                        <span className="eyebrow shrink-0">Term</span>
                      </Link>
                    </li>
                  );
                }

                const Icon =
                  r.kind === "session"
                    ? GraduationCap
                    : r.kind === "macro"
                      ? Globe
                      : r.kind === "quant"
                        ? LineChart
                        : FileText;
                const label =
                  r.kind === "session"
                    ? "Session"
                    : r.kind === "macro"
                      ? "Macro"
                      : r.kind === "quant"
                        ? "Quant"
                        : "Pitch";
                const title = r.kind === "pitch" ? `${r.ticker} · ${r.title}` : r.title;

                return (
                  <li key={`${r.kind}-${r.slug}-${i}`}>
                    <Link
                      href={r.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/60"
                    >
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">
                          {title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {r.summary}
                        </p>
                      </div>
                      <span className="eyebrow shrink-0">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
