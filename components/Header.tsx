import Link from "next/link";
import { Logo } from "./Logo";
import { SearchCommand } from "./SearchCommand";
import { cn } from "@/lib/utils";
import {
  getAllPitches,
  getAllLibrary,
  getGlossary,
} from "@/lib/content";
import type { SearchableItem } from "@/lib/search";
import { LIBRARY_META } from "@/lib/types";

const navItems = [
  { href: "/pitches", label: "Pitches" },
  { href: "/votings", label: "Votings" },
  { href: "/sessions", label: "Sessions" },
  { href: "/macro", label: "Macro" },
  { href: "/quant", label: "Quant" },
  { href: "/glossary", label: "Glossary" },
  { href: "/contribute", label: "Contribute" },
];

export async function Header({ className }: { className?: string }) {
  const [library, pitches, terms] = await Promise.all([
    getAllLibrary(),
    getAllPitches(),
    getGlossary(),
  ]);

  const searchItems: SearchableItem[] = [
    ...library.map((m) => ({
      kind: m.kind,
      slug: m.slug,
      title: m.frontmatter.title,
      summary: m.frontmatter.summary,
      tags: m.frontmatter.tags,
      href: `${LIBRARY_META[m.kind].route}/${m.slug}`,
    })),
    ...pitches.map((p) => ({
      kind: "pitch" as const,
      slug: p.slug,
      ticker: p.frontmatter.ticker,
      title: p.frontmatter.title,
      summary: p.frontmatter.keyTakeaways[0] ?? "",
      tags: p.frontmatter.tags ?? [],
      href: `/pitches/${p.slug}`,
    })),
    ...terms.map((t) => ({
      kind: "term" as const,
      term: t.term,
      fullName: t.fullName,
      definition: t.definition,
      href: `/glossary#${t.term.toLowerCase().replace(/\s+/g, "-")}`,
    })),
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur",
        className,
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-6">
        <Logo />

        <nav
          className="hidden md:flex items-center gap-6 lg:gap-7"
          aria-label="Primary"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <SearchCommand items={searchItems} />
        </div>

        <nav
          className="flex md:hidden items-center gap-3 overflow-x-auto"
          aria-label="Primary mobile"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[12px] font-medium text-foreground/80 whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
