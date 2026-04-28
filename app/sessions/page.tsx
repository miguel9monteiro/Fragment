import type { Metadata } from "next";
import { Suspense } from "react";
import { getSessions } from "@/lib/content";
import { LibraryIndex } from "@/components/LibraryIndex";

export const metadata: Metadata = {
  title: "Learning sessions",
  description:
    "Structured lessons that teach the methods, frameworks, and standards the club expects in equity research.",
};

export default async function SessionsPage() {
  const items = await getSessions();
  const data = items.map((m) => ({
    kind: m.kind,
    slug: m.slug,
    frontmatter: m.frontmatter,
  }));
  return (
    <Suspense fallback={null}>
      <LibraryIndex kind="session" items={data} />
    </Suspense>
  );
}
