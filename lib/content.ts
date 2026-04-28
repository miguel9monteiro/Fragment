import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import {
  MODULE_CATEGORIES,
  ModuleCategory,
  ModuleEntry,
  moduleFrontmatterSchema,
  PitchEntry,
  pitchFrontmatterSchema,
  GlossaryTerm,
  glossaryTermSchema,
} from "./types";

const CONTENT_ROOT = path.join(process.cwd(), "content");
const MODULES_ROOT = path.join(CONTENT_ROOT, "modules");
const PITCHES_ROOT = path.join(CONTENT_ROOT, "pitches");
const GLOSSARY_PATH = path.join(CONTENT_ROOT, "glossary", "terms.json");

/* -------------------------------------------------------------------------- */
/*  Modules                                                                    */
/* -------------------------------------------------------------------------- */

async function readDirSafe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

async function loadModulesFromCategory(
  category: ModuleCategory,
): Promise<ModuleEntry[]> {
  const dir = path.join(MODULES_ROOT, category);
  const files = await readDirSafe(dir);
  const mdxFiles = files.filter((f) => f.endsWith(".mdx") || f.endsWith(".md"));

  return Promise.all(
    mdxFiles.map(async (file) => {
      const filePath = path.join(dir, file);
      const raw = await fs.readFile(filePath, "utf8");
      const { content, data } = matter(raw);
      const parsed = moduleFrontmatterSchema.safeParse({
        ...data,
        category,
      });
      if (!parsed.success) {
        throw new Error(
          `Invalid frontmatter in ${filePath}:\n${parsed.error.toString()}`,
        );
      }
      const slug = parsed.data.slug ?? file.replace(/\.mdx?$/, "");
      return {
        slug,
        category,
        filePath,
        source: content,
        frontmatter: parsed.data,
      };
    }),
  );
}

export const getAllModules = cache(async (): Promise<ModuleEntry[]> => {
  const buckets = await Promise.all(
    MODULE_CATEGORIES.map((c) => loadModulesFromCategory(c)),
  );
  const flat = buckets.flat();
  flat.sort((a, b) =>
    a.frontmatter.title.localeCompare(b.frontmatter.title),
  );
  return flat;
});

export async function getModule(
  category: string,
  slug: string,
): Promise<ModuleEntry | null> {
  const all = await getAllModules();
  return (
    all.find((m) => m.category === category && m.slug === slug) ?? null
  );
}

export async function getModuleBySlug(
  slug: string,
): Promise<ModuleEntry | null> {
  const all = await getAllModules();
  return all.find((m) => m.slug === slug) ?? null;
}

export async function getModulesByCategory(
  category: ModuleCategory,
): Promise<ModuleEntry[]> {
  const all = await getAllModules();
  return all.filter((m) => m.category === category);
}

export async function getFeaturedModules(): Promise<ModuleEntry[]> {
  const all = await getAllModules();
  return all.filter((m) => m.frontmatter.featured);
}

export async function getAdjacentModules(
  current: ModuleEntry,
): Promise<{ prev: ModuleEntry | null; next: ModuleEntry | null }> {
  const sameCategory = (await getModulesByCategory(current.category)).sort(
    (a, b) => a.frontmatter.title.localeCompare(b.frontmatter.title),
  );
  const idx = sameCategory.findIndex((m) => m.slug === current.slug);
  return {
    prev: idx > 0 ? sameCategory[idx - 1] : null,
    next:
      idx >= 0 && idx < sameCategory.length - 1 ? sameCategory[idx + 1] : null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Pitches                                                                    */
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
