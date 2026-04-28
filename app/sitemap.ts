import type { MetadataRoute } from "next";
import {
  getAllPitches,
  getSessions,
  getMacro,
  getQuant,
} from "@/lib/content";
import { LIBRARY_META } from "@/lib/types";

const baseUrl = "https://pmc-knowledge.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pitches, sessions, macro, quant] = await Promise.all([
    getAllPitches(),
    getSessions(),
    getMacro(),
    getQuant(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/pitches",
    "/sessions",
    "/macro",
    "/quant",
    "/glossary",
    "/contribute",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const libraryRoutes = [
    ...sessions.map((m) => ({
      url: `${baseUrl}${LIBRARY_META.session.route}/${m.slug}`,
      lastModified: new Date(m.frontmatter.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...macro.map((m) => ({
      url: `${baseUrl}${LIBRARY_META.macro.route}/${m.slug}`,
      lastModified: new Date(m.frontmatter.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...quant.map((m) => ({
      url: `${baseUrl}${LIBRARY_META.quant.route}/${m.slug}`,
      lastModified: new Date(m.frontmatter.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  const pitchRoutes = pitches.map((p) => ({
    url: `${baseUrl}/pitches/${p.slug}`,
    lastModified: new Date(p.frontmatter.date),
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...libraryRoutes, ...pitchRoutes];
}
