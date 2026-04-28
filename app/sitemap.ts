import type { MetadataRoute } from "next";
import { getAllModules, getAllPitches } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://pmc-knowledge.vercel.app";
  const [modules, pitches] = await Promise.all([
    getAllModules(),
    getAllPitches(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/modules",
    "/pitches",
    "/glossary",
    "/contribute",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const moduleRoutes = modules.map((m) => ({
    url: `${baseUrl}/modules/${m.category}/${m.slug}`,
    lastModified: new Date(m.frontmatter.lastUpdated),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const pitchRoutes = pitches.map((p) => ({
    url: `${baseUrl}/pitches/${p.slug}`,
    lastModified: new Date(p.frontmatter.date),
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...moduleRoutes, ...pitchRoutes];
}
