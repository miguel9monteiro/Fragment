import type { Metadata } from "next";
import { Suspense } from "react";
import { getQuant } from "@/lib/content";
import { LibraryIndex } from "@/components/LibraryIndex";

export const metadata: Metadata = {
  title: "Quant presentations",
  description:
    "Quantitative work from the club: factor models, backtesting, statistical methods, and applied research.",
};

export default async function QuantPage() {
  const items = await getQuant();
  const data = items.map((m) => ({
    kind: m.kind,
    slug: m.slug,
    frontmatter: m.frontmatter,
  }));
  return (
    <Suspense fallback={null}>
      <LibraryIndex kind="quant" items={data} />
    </Suspense>
  );
}
