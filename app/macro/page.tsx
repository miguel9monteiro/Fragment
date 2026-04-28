import type { Metadata } from "next";
import { Suspense } from "react";
import { getMacro } from "@/lib/content";
import { LibraryIndex } from "@/components/LibraryIndex";

export const metadata: Metadata = {
  title: "Macro outlooks",
  description:
    "Periodic readings of the macro backdrop — rates, growth, liquidity — and what they mean for portfolio positioning.",
};

export default async function MacroPage() {
  const items = await getMacro();
  const data = items.map((m) => ({
    kind: m.kind,
    slug: m.slug,
    frontmatter: m.frontmatter,
  }));
  return (
    <Suspense fallback={null}>
      <LibraryIndex kind="macro" items={data} />
    </Suspense>
  );
}
