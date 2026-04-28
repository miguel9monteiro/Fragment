import type { Metadata } from "next";
import { getGlossary } from "@/lib/content";
import { GlossaryClient } from "./GlossaryClient";

export const metadata: Metadata = {
  title: "Glossary",
  description:
    "Shared vocabulary for PMC equity research — terms, definitions, and links to the modules that explore them.",
};

export default async function GlossaryPage() {
  const terms = await getGlossary();
  return <GlossaryClient terms={terms} />;
}
