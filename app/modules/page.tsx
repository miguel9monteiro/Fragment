import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllModules } from "@/lib/content";
import { ModulesIndex } from "./ModulesIndex";

export const metadata: Metadata = {
  title: "Modules",
  description:
    "Filterable index of all PMC learning modules — by category, difficulty, and tag.",
};

export default async function ModulesPage() {
  const modules = await getAllModules();
  // Pass plain serializable data to the client component
  const data = modules.map((m) => ({
    slug: m.slug,
    category: m.category,
    frontmatter: m.frontmatter,
  }));
  return (
    <Suspense fallback={null}>
      <ModulesIndex modules={data} />
    </Suspense>
  );
}
