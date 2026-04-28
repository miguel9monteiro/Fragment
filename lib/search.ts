/**
 * Lightweight client-side search index for modules + glossary.
 * No fuse.js dependency for v1 — a 30-line custom matcher that uses
 * token-prefix matching on title/tags/summary/term/definition.
 *
 * Returns results sorted by score descending, capped at 30.
 */

export type SearchableModule = {
  kind: "module";
  slug: string;
  category: string;
  title: string;
  summary: string;
  tags: string[];
  href: string;
};

export type SearchableTerm = {
  kind: "term";
  term: string;
  fullName?: string;
  definition: string;
  href: string;
};

export type SearchableItem = SearchableModule | SearchableTerm;

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

export function search(
  items: SearchableItem[],
  query: string,
): SearchableItem[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const scored = items.map((item) => {
    const corpus =
      item.kind === "module"
        ? `${item.title} ${item.summary} ${item.tags.join(" ")}`
        : `${item.term} ${item.fullName ?? ""} ${item.definition}`;
    const corpusTokens = tokenize(corpus);

    let score = 0;
    for (const t of tokens) {
      let bestMatch = 0;
      for (const ct of corpusTokens) {
        if (ct === t) bestMatch = Math.max(bestMatch, 3);
        else if (ct.startsWith(t)) bestMatch = Math.max(bestMatch, 2);
        else if (ct.includes(t)) bestMatch = Math.max(bestMatch, 1);
      }
      score += bestMatch;
    }

    // Title/term match boost
    const titleField =
      item.kind === "module" ? item.title.toLowerCase() : item.term.toLowerCase();
    if (tokens.every((t) => titleField.includes(t))) score += 4;

    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((s) => s.item);
}
