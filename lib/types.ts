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

/* -------------------------------------------------------------------------- */
/*  Polls — the voting record on club pitches and rebalances                  */
/* -------------------------------------------------------------------------- */

export const POLL_ASSET_CLASSES = [
  "equity",
  "bond",
  "commodity",
  "fx",
] as const;
export type PollAssetClass = (typeof POLL_ASSET_CLASSES)[number];

export const ASSET_CLASS_LABELS: Record<PollAssetClass, string> = {
  equity: "Equity",
  bond: "Bond",
  commodity: "Commodity",
  fx: "FX",
};

/**
 * The kind of decision being voted on.
 *  - entry: new position
 *  - exit: existing position, vote on whether to sell
 *  - rebalance: existing position, vote on resizing
 */
export const MOTION_TYPES = ["entry", "exit", "rebalance"] as const;
export type MotionType = (typeof MOTION_TYPES)[number];

/**
 * Which forum voted: the main floor (full membership) or the smaller
 * Extended Board.
 */
export const POLL_FORUMS = ["main", "extended-board"] as const;
export type PollForum = (typeof POLL_FORUMS)[number];

/**
 * The semantic role of an option, used to colour the vote bar
 * consistently across different motion shapes.
 *  - buy: take the position / approve buying
 *  - sell: exit / approve selling
 *  - hold: don't change anything (covers "Don't Buy", "Hold")
 *  - increase: bump the position size
 *  - abstain: "No opinion"
 */
export const OPTION_KINDS = ["buy", "sell", "hold", "increase", "abstain"] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];

export const pollOptionSchema = z.object({
  label: z.string().min(1),
  count: z.number().int().nonnegative(),
  kind: z.enum(OPTION_KINDS),
});

export const pollSchema = z.object({
  /** Url-safe identifier, e.g. "2026-04-15-itrn". */
  slug: z.string().min(1),
  date: z.string(),
  semester: z.string().min(1),
  /** The asset being voted on, e.g. "ITRN", "JPY", "Altria Group Bond". */
  subject: z.string().min(1),
  assetClass: z.enum(POLL_ASSET_CLASSES),
  motionType: z.enum(MOTION_TYPES),
  forum: z.enum(POLL_FORUMS),
  /** Optional one-line description of the proposal. */
  motion: z.string().optional(),
  /** Optional link to the corresponding pitch teaching page. */
  pitchSlug: z.string().optional(),
  options: z.array(pollOptionSchema).min(2),
});

export type PollOption = z.infer<typeof pollOptionSchema>;
export type Poll = z.infer<typeof pollSchema>;

/* -------------------------------------------------------------------------- */
/*  Portfolio — virtual portfolio dashboard                                   */
/* -------------------------------------------------------------------------- */

export const performanceMetricsSchema = z.object({
  daily: z.union([z.number(), z.string()]).nullable(),
  weekly: z.union([z.number(), z.string()]).nullable(),
  monthly: z.union([z.number(), z.string()]).nullable(),
  quarterly: z.union([z.number(), z.string()]).nullable(),
  semester: z.union([z.number(), z.string()]).nullable(),
  ytd: z.union([z.number(), z.string()]).nullable(),
  yearly: z.union([z.number(), z.string()]).nullable(),
  cumulative: z.union([z.number(), z.string()]).nullable(),
  vol1y: z.union([z.number(), z.string()]).nullable(),
  volSi: z.union([z.number(), z.string()]).nullable(),
  sharpe1y: z.union([z.number(), z.string()]).nullable(),
  sharpeSi: z.union([z.number(), z.string()]).nullable(),
  maxDd1y: z.union([z.number(), z.string()]).nullable(),
  maxDdSi: z.union([z.number(), z.string()]).nullable(),
  skew1y: z.union([z.number(), z.string()]).nullable(),
  kurtosis1y: z.union([z.number(), z.string()]).nullable(),
  var1y: z.union([z.number(), z.string()]).nullable(),
  varSi: z.union([z.number(), z.string()]).nullable(),
  winDays1y: z.union([z.number(), z.string()]).nullable(),
  winDaysSi: z.union([z.number(), z.string()]).nullable(),
});
export type PerformanceMetrics = z.infer<typeof performanceMetricsSchema>;

export const holdingSchema = z.object({
  assetType: z.string(),
  sector: z.string().nullable(),
  name: z.string(),
  ticker: z.string(),
  shares: z.number(),
  currency: z.string(),
  invested: z.number(),
  purchaseDate: z.string().nullable(),
  averageCost: z.number(),
  currentPriceUsd: z.number(),
  currentValue: z.number(),
  weight: z.number(),
  pitchSlug: z.string().nullable(),
  pollSlug: z.string().nullable(),
});
export type Holding = z.infer<typeof holdingSchema>;

export const allocationRowSchema = z.object({
  count: z.number(),
  invested: z.number(),
  currentValue: z.number(),
  weight: z.number(),
});
export const assetTypeRowSchema = allocationRowSchema.extend({
  assetType: z.string(),
});
export const sectorRowSchema = allocationRowSchema.extend({
  sector: z.string(),
});
export type AssetTypeRow = z.infer<typeof assetTypeRowSchema>;
export type SectorRow = z.infer<typeof sectorRowSchema>;

export const performancePointSchema = z.object({
  date: z.string(),
  portfolioReturn: z.number(),
  benchmarkReturn: z.number(),
  portfolioCum: z.number(),
  benchmarkCum: z.number(),
});
export type PerformancePoint = z.infer<typeof performancePointSchema>;

export const portfolioSchema = z.object({
  asOfDate: z.string(),
  inceptionDate: z.string(),
  totals: z.object({
    portfolio: z.number(),
    cash: z.number(),
    aum: z.number(),
  }),
  performance: z.object({
    portfolio: performanceMetricsSchema,
    benchmark: performanceMetricsSchema,
  }),
  byAssetType: z.array(assetTypeRowSchema),
  bySector: z.array(sectorRowSchema),
  holdings: z.array(holdingSchema),
  performanceSeries: z.array(performancePointSchema),
});
export type Portfolio = z.infer<typeof portfolioSchema>;

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
