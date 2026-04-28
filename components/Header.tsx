import Link from "next/link";
import { Logo } from "./Logo";
import { SearchCommand } from "./SearchCommand";
import { cn } from "@/lib/utils";
import { getAllModules, getGlossary } from "@/lib/content";
import type { SearchableItem } from "@/lib/search";
import { CATEGORY_LABELS } from "@/lib/types";

const navItems = [
  { href: "/modules", label: "Modules" },
  { href: "/pitches", label: "Pitch archive" },
  { href: "/glossary", label: "Glossary" },
  { href: "/contribute", label: "Contribute" },
];

export async function Header({ className }: { className?: string }) {
  const [modules, terms] = await Promise.all([
    getAllModules(),
    getGlossary(),
  ]);

  const searchItems: SearchableItem[] = [
    ...modules.map((m) => ({
      kind: "module" as const,
      slug: m.slug,
      category: CATEGORY_LABELS[m.category],
      title: m.frontmatter.title,
      summary: m.frontmatter.summary,
      tags: m.frontmatter.tags,
      href: `/modules/${m.category}/${m.slug}`,
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

        <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
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

        {/* Mobile nav */}
        <nav
          className="flex md:hidden items-center gap-4 overflow-x-auto"
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
