import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Library kinds — the four content categories the club produces.             */
/* -------------------------------------------------------------------------- */

export const LIBRARY_KINDS = ["session", "macro", "quant", "pitch"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export type LibraryKindMeta = {
  /** URL-safe directory + route slug. */
  dir: string;
  /** Plural label used as page title and nav. */
  label: string;
  /** Singular label used in card eyebrows and breadcrumbs. */
  singular: string;
  /** One-line description used on index pages and the home grid. */
  description: string;
  /** Route prefix, no trailing slash. */
  route: string;
};

export const LIBRARY_META: Record<
  Exclude<LibraryKind, "pitch">,
  LibraryKindMeta
> = {
  session: {
    dir: "sessions",
    label: "Learning sessions",
    singular: "Learning session",
    description:
      "Structured lessons that teach the methods, frameworks, and standards the club expects in equity research.",
    route: "/sessions",
  },
  macro: {
    dir: "macro",
    label: "Macro outlooks",
    singular: "Macro outlook",
    description:
      "Periodic readings of the macro backdrop — rates, growth, liquidity — and what they mean for portfolio positioning.",
    route: "/macro",
  },
  quant: {
    dir: "quant",
    label: "Quant presentations",
    singular: "Quant presentation",
    description:
      "Quantitative work from the club: factor models, backtesting, statistical methods, and applied research.",
    route: "/quant",
  },
};

/* -------------------------------------------------------------------------- */
/*  Difficulty (used by sessions and quant presentations)                      */
/* -------------------------------------------------------------------------- */

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/* -------------------------------------------------------------------------- */
/*  Article — shared by sessions and quant presentations                       */
/* -------------------------------------------------------------------------- */

export const articleFrontmatterSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  author: z.string().min(1),
  team: z.string().optional(),
  date: z.string(),
  difficulty: z.enum(DIFFICULTIES),
  estimatedReadTime: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
  summary: z.string().min(1),
  featured: z.boolean().optional().default(false),
  /** Optional link to the original deck or document the piece is based on. */
  sourcePdfUrl: z.string().optional(),
});

export type ArticleFrontmatter = z.infer<typeof articleFrontmatterSchema>;

/* -------------------------------------------------------------------------- */
/*  Macro outlook                                                              */
/* -------------------------------------------------------------------------- */

export const macroFrontmatterSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  author: z.string().min(1),
  team: z.string().optional(),
  date: z.string(),
  /** Reporting period this outlook covers (e.g., "Q2 2026", "May 2026"). */
  period: z.string().min(1),
  /** Optional geographic scope (e.g., "Global", "US", "Europe"). */
  region: z.string().optional(),
  tags: z.array(z.string()).default([]),
  summary: z.string().min(1),
  featured: z.boolean().optional().default(false),
  /** Optional link to the original deck or document. */
  sourcePdfUrl: z.string().optional(),
});

export type MacroFrontmatter = z.infer<typeof macroFrontmatterSchema>;

/* -------------------------------------------------------------------------- */
/*  Loaded entries                                                             */
/* -------------------------------------------------------------------------- */

export type ArticleEntry = {
  kind: "session" | "quant";
  slug: string;
  filePath: string;
  source: string;
  frontmatter: ArticleFrontmatter;
};

export type MacroEntry = {
  kind: "macro";
  slug: string;
  filePath: string;
  source: string;
  frontmatter: MacroFrontmatter;
};

/** Anything that lives under /content/{sessions, macro, quant}/. */
export type LibraryEntry = ArticleEntry | MacroEntry;

/* -------------------------------------------------------------------------- */
/*  Stock pitches                                                              */
/* -------------------------------------------------------------------------- */

export const RECOMMENDATIONS = ["BUY", "HOLD", "SELL"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const pitchFrontmatterSchema = z.object({
  title: z.string().min(1),
  ticker: z.string().min(1),
  semester: z.string().min(1),
  team: z.string().min(1),
  date: z.string(),
  recommendation: z.enum(RECOMMENDATIONS),
  sector: z.string().min(1),
  analysts: z.array(z.string()).min(1),
  sourcePdfUrl: z.string().optional(),
  keyTakeaways: z.array(z.string()).min(1),
  tags: z.array(z.string()).default([]),
});

export type PitchFrontmatter = z.infer<typeof pitchFrontmatterSchema>;

export type PitchEntry = {
  kind: "pitch";
  slug: string;
  semesterSlug: string;
  filePath: string;
  source: string;
  frontmatter: PitchFrontmatter;
};

/* -------------------------------------------------------------------------- */
/*  Glossary                                                                   */
/* -------------------------------------------------------------------------- */

export const glossaryTermSchema = z.object({
  term: z.string().min(1),
  fullName: z.string().optional(),
  definition: z.string().min(1),
  /** Optional free-form subject category for grouping. */
  category: z.string().optional(),
  /** Slugs of related library items across any kind. */
  relatedItems: z.array(z.string()).default([]),
});

export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;
