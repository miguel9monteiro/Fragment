import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMacro, getMacroItem } from "@/lib/content";
import { LibraryItemPage } from "@/components/LibraryItemPage";
import type { LibraryEntry } from "@/lib/types";

export async function generateStaticParams() {
  const items = await getMacro();
  return items.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getMacroItem(slug);
  if (!item) return {};
  return {
    title: item.frontmatter.title,
    description: item.frontmatter.summary,
  };
}

export default async function MacroDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getMacroItem(slug);
  if (!item) notFound();

  const all = await getMacro();
  const idx = all.findIndex((m) => m.slug === slug);
  const prev: LibraryEntry | null = idx > 0 ? all[idx - 1] : null;
  const next: LibraryEntry | null = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

  return <LibraryItemPage item={item} prev={prev} next={next} />;
}
