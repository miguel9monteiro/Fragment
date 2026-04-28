import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import type { MDXRemoteProps } from "next-mdx-remote/rsc";

export const mdxOptions: NonNullable<MDXRemoteProps["options"]>["mdxOptions"] = {
  remarkPlugins: [remarkGfm, remarkMath],
  rehypePlugins: [rehypeSlug, rehypeKatex],
};

/**
 * Extract `## ` and `### ` headings from MDX source for the
 * sticky table of contents. Skips content inside code fences.
 */
export type TocItem = {
  depth: 2 | 3;
  text: string;
  id: string;
};

const slugId = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

export function extractToc(source: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = source.split("\n");
  let inFence = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!match) continue;
    const depth = match[1].length as 2 | 3;
    const text = match[2].replace(/[*_`]/g, "").trim();
    items.push({ depth, text, id: slugId(text) });
  }

  return items;
}

/**
 * Approximate read time. Words / 220 wpm, rounded.
 * Used as a fallback if frontmatter `estimatedReadTime` is missing.
 */
export function estimateReadTime(source: string): number {
  const words = source.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
