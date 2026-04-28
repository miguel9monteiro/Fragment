import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllPolls } from "@/lib/content";
import { VotingsClient } from "./VotingsClient";

export const metadata: Metadata = {
  title: "Votings",
  description:
    "The voting record — every poll the club has voted on, with the outcome of each, filterable by semester, asset class, and forum.",
};

export default async function VotingsPage() {
  const polls = await getAllPolls();
  return (
    <Suspense fallback={null}>
      <VotingsClient polls={polls} />
    </Suspense>
  );
}
