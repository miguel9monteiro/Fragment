import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*  Module                                                                     */
/* -------------------------------------------------------------------------- */

export const MODULE_CATEGORIES = [
  "valuation",
  "accounting",
  "credit",
  "industry",
  "ma-corporate-actions",
  "portfolio-risk",
  "macro-markets",
  "q-and-a-prep",
] as const;

export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  valuation: "Valuation",
  accounting: "Accounting",
  credit: "Credit",
  industry: "Industry",
  "ma-corporate-actions": "M&A and corporate actions",
  "portfolio-risk": "Portfolio and risk",
  "macro-markets": "Macro and markets",
  "q-and-a-prep": "Q&A preparation",
};

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const moduleFrontmatterSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  category: z.enum(MODULE_CATEGORIES),
  author: z.string().min(1),
  team: z.string().optional(),
  difficulty: z.enum(DIFFICULTIES),
  estimatedReadTime: z.number().int().positive(),
  prerequisites: z.array(z.string()).default([]),
  lastUpdated: z.string(),
  tags: z.array(z.string()).default([]),
  summary: z.string().min(1),
  featured: z.boolean().optional().default(false),
});

export type ModuleFrontmatter = z.infer<typeof moduleFrontmatterSchema>;

export type ModuleEntry = {
  slug: string;
  category: ModuleCategory;
  filePath: string;
  source: string;
  frontmatter: ModuleFrontmatter;
};

/* -------------------------------------------------------------------------- */
/*  Pitch                                                                      */
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
});

export type PitchFrontmatter = z.infer<typeof pitchFrontmatterSchema>;

export type PitchEntry = {
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
  category: z.string().optional(),
  relatedModules: z.array(z.string()).default([]),
});

export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;
