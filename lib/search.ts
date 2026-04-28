/**
 * Lightweight client-side search across the library, pitches, and glossary.
 * No fuse.js dependency — a small token-prefix matcher.
 */

export type SearchableLibraryItem = {
  kind: "session" | "macro" | "quant";
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  href: string;
};

export type SearchablePitch = {
  kind: "pitch";
  slug: string;
  ticker: string;
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

export type SearchableItem =
  | SearchableLibraryItem
  | SearchablePitch
  | SearchableTerm;

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
      item.kind === "term"
        ? `${item.term} ${item.fullName ?? ""} ${item.definition}`
        : item.kind === "pitch"
          ? `${item.ticker} ${item.title} ${item.summary} ${item.tags.join(" ")}`
          : `${item.title} ${item.summary} ${item.tags.join(" ")}`;
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

    // Title / term / ticker boost
    const titleField =
      item.kind === "term"
        ? item.term.toLowerCase()
        : item.kind === "pitch"
          ? `${item.ticker} ${item.title}`.toLowerCase()
          : item.title.toLowerCase();
    if (tokens.every((t) => titleField.includes(t))) score += 4;

    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((s) => s.item);
}
