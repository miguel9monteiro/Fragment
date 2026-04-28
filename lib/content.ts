import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import {
  LIBRARY_META,
  ArticleEntry,
  articleFrontmatterSchema,
  MacroEntry,
  macroFrontmatterSchema,
  LibraryEntry,
  PitchEntry,
  pitchFrontmatterSchema,
  GlossaryTerm,
  glossaryTermSchema,
  Poll,
  pollSchema,
} from "./types";

const CONTENT_ROOT = path.join(process.cwd(), "content");
const PITCHES_ROOT = path.join(CONTENT_ROOT, "pitches");
const GLOSSARY_PATH = path.join(CONTENT_ROOT, "glossary", "terms.json");
const POLLS_PATH = path.join(CONTENT_ROOT, "polls", "polls.json");

async function readDirSafe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/*  Articles — sessions and quant presentations share the same shape.          */
/* -------------------------------------------------------------------------- */

async function loadArticles(
  kind: "session" | "quant",
): Promise<ArticleEntry[]> {
  const dir = path.join(CONTENT_ROOT, LIBRARY_META[kind].dir);
  const files = await readDirSafe(dir);
  const mdxFiles = files.filter((f) => f.endsWith(".mdx") || f.endsWith(".md"));

  return Promise.all(
    mdxFiles.map(async (file) => {
      const filePath = path.join(dir, file);
      const raw = await fs.readFile(filePath, "utf8");
      const { content, data } = matter(raw);
      const parsed = articleFrontmatterSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(
          `Invalid ${kind} frontmatter in ${filePath}:\n${parsed.error.toString()}`,
        );
      }
      const slug = parsed.data.slug ?? file.replace(/\.mdx?$/, "");
      return {
        kind,
        slug,
        filePath,
        source: content,
        frontmatter: parsed.data,
      };
    }),
  );
}

/* -------------------------------------------------------------------------- */
/*  Macro outlooks                                                             */
/* -------------------------------------------------------------------------- */

async function loadMacro(): Promise<MacroEntry[]> {
  const dir = path.join(CONTENT_ROOT, LIBRARY_META.macro.dir);
  const files = await readDirSafe(dir);
  const mdxFiles = files.filter((f) => f.endsWith(".mdx") || f.endsWith(".md"));

  return Promise.all(
    mdxFiles.map(async (file) => {
      const filePath = path.join(dir, file);
      const raw = await fs.readFile(filePath, "utf8");
      const { content, data } = matter(raw);
      const parsed = macroFrontmatterSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(
          `Invalid macro frontmatter in ${filePath}:\n${parsed.error.toString()}`,
        );
      }
      const slug = parsed.data.slug ?? file.replace(/\.mdx?$/, "");
      return {
        kind: "macro" as const,
        slug,
        filePath,
        source: content,
        frontmatter: parsed.data,
      };
    }),
  );
}

/* -------------------------------------------------------------------------- */
/*  Public API — sessions, macro, quant                                        */
/* -------------------------------------------------------------------------- */

const byDateDesc = (a: { frontmatter: { date: string } }, b: { frontmatter: { date: string } }) =>
  new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime();

export const getSessions = cache(async (): Promise<ArticleEntry[]> => {
  const items = await loadArticles("session");
  items.sort(byDateDesc);
  return items;
});

export const getQuant = cache(async (): Promise<ArticleEntry[]> => {
  const items = await loadArticles("quant");
  items.sort(byDateDesc);
  return items;
});

export const getMacro = cache(async (): Promise<MacroEntry[]> => {
  const items = await loadMacro();
  items.sort(byDateDesc);
  return items;
});

export async function getSession(slug: string): Promise<ArticleEntry | null> {
  const all = await getSessions();
  return all.find((m) => m.slug === slug) ?? null;
}

export async function getQuantItem(
  slug: string,
): Promise<ArticleEntry | null> {
  const all = await getQuant();
  return all.find((m) => m.slug === slug) ?? null;
}

export async function getMacroItem(slug: string): Promise<MacroEntry | null> {
  const all = await getMacro();
  return all.find((m) => m.slug === slug) ?? null;
}

/** Sessions + macro + quant — flat list, newest first. */
export async function getAllLibrary(): Promise<LibraryEntry[]> {
  const [sessions, macro, quant] = await Promise.all([
    getSessions(),
    getMacro(),
    getQuant(),
  ]);
  return [...sessions, ...macro, ...quant].sort(byDateDesc);
}

export async function getFeaturedLibrary(): Promise<LibraryEntry[]> {
  const all = await getAllLibrary();
  return all.filter((e) => e.frontmatter.featured);
}

/* -------------------------------------------------------------------------- */
/*  Pitches — unchanged shape, plus tag support                                */
/* -------------------------------------------------------------------------- */

export const getAllPitches = cache(async (): Promise<PitchEntry[]> => {
  const semesters = await readDirSafe(PITCHES_ROOT);
  const entries: PitchEntry[] = [];

  for (const semesterSlug of semesters) {
    const semesterDir = path.join(PITCHES_ROOT, semesterSlug);
    const stat = await fs.stat(semesterDir).catch(() => null);
    if (!stat || !stat.isDirectory()) continue;

    const pitchDirs = await readDirSafe(semesterDir);
    for (const pitchSlug of pitchDirs) {
      const pitchDir = path.join(semesterDir, pitchSlug);
      const pitchStat = await fs.stat(pitchDir).catch(() => null);
      if (!pitchStat || !pitchStat.isDirectory()) continue;

      const indexPath = path.join(pitchDir, "index.mdx");
      const raw = await fs.readFile(indexPath, "utf8").catch(() => null);
      if (!raw) continue;

      const { content, data } = matter(raw);
      const parsed = pitchFrontmatterSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(
          `Invalid pitch frontmatter in ${indexPath}:\n${parsed.error.toString()}`,
        );
      }

      entries.push({
        kind: "pitch",
        slug: pitchSlug,
        semesterSlug,
        filePath: indexPath,
        source: content,
        frontmatter: parsed.data,
      });
    }
  }

  entries.sort(
    (a, b) =>
      new Date(b.frontmatter.date).getTime() -
      new Date(a.frontmatter.date).getTime(),
  );
  return entries;
});

export async function getPitch(slug: string): Promise<PitchEntry | null> {
  const all = await getAllPitches();
  return all.find((p) => p.slug === slug) ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Glossary                                                                   */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Polls — voting record                                                     */
/* -------------------------------------------------------------------------- */

export const getAllPolls = cache(async (): Promise<Poll[]> => {
  const raw = await fs.readFile(POLLS_PATH, "utf8").catch(() => "[]");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Polls file must be a JSON array.");
  }
  const polls = parsed.map((entry, i) => {
    const r = pollSchema.safeParse(entry);
    if (!r.success) {
      throw new Error(
        `Invalid poll entry at index ${i}:\n${r.error.toString()}`,
      );
    }
    return r.data;
  });
  // Newest first; this is the order most filters / lists want.
  polls.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return polls;
});

/* -------------------------------------------------------------------------- */
/*  Glossary                                                                   */
/* -------------------------------------------------------------------------- */

export const getGlossary = cache(async (): Promise<GlossaryTerm[]> => {
  const raw = await fs.readFile(GLOSSARY_PATH, "utf8").catch(() => "[]");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Glossary file must be a JSON array.");
  }
  const terms = parsed.map((entry, i) => {
    const r = glossaryTermSchema.safeParse(entry);
    if (!r.success) {
      throw new Error(
        `Invalid glossary entry at index ${i}:\n${r.error.toString()}`,
      );
    }
    return r.data;
  });
  terms.sort((a, b) => a.term.localeCompare(b.term));
  return terms;
});

export async function getGlossaryTerm(
  slug: string,
): Promise<GlossaryTerm | null> {
  const all = await getGlossary();
  const target = slug.toLowerCase();
  return (
    all.find(
      (t) =>
        t.term.toLowerCase() === target ||
        t.term.toLowerCase().replace(/\s+/g, "-") === target,
    ) ?? null
  );
}
