"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { TocItem } from "@/lib/mdx";

export function TableOfContents({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || items.length === 0) return;
    const ids = items.map((i) => i.id);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop,
          );
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      {
        rootMargin: "-80px 0px -65% 0px",
        threshold: [0, 1],
      },
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="text-sm">
      <p className="eyebrow mb-3">On this page</p>
      <ul className="space-y-2 border-l border-border">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(item.depth === 3 && "pl-3")}
            style={{ marginLeft: item.depth === 3 ? "0.5rem" : 0 }}
          >
            <a
              href={`#${item.id}`}
              className={cn(
                "block -ml-px border-l border-transparent pl-3 py-0.5 leading-snug transition-colors",
                active === item.id
                  ? "border-gold text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
