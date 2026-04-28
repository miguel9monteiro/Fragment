import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import { getAllPitches } from "@/lib/content";
import { RecommendationBadge } from "@/components/RecommendationBadge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pitch archive",
  description:
    "An archive of past PMC investment pitches presented as teaching walkthroughs.",
};

export default async function PitchesPage() {
  const pitches = await getAllPitches();

  // Group by semester (preserve sort order)
  const bySemester = new Map<string, typeof pitches>();
  for (const p of pitches) {
    const arr = bySemester.get(p.frontmatter.semester) ?? [];
    arr.push(p);
    bySemester.set(p.frontmatter.semester, arr);
  }

  return (
    <>
      <section className="container pt-12 pb-10 border-b border-border">
        <p className="eyebrow-gold mb-3">Archive</p>
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
          Pitch archive
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
          Each entry is a teaching walkthrough — annotated slides, commentary
          on what worked, and the questions a senior member would ask in
          Q&amp;A. Read these the way you would read a research note.
        </p>
      </section>

      <section className="container py-14">
        {pitches.length === 0 ? (
          <div className="border border-dashed border-border py-20 text-center rounded-sm">
            <p className="font-serif text-xl font-semibold mb-2">
              No pitches in the archive yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Add an MDX file under{" "}
              <code className="font-mono text-xs">
                /content/pitches/&lt;semester&gt;/&lt;ticker&gt;/index.mdx
              </code>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-16">
            {[...bySemester.entries()].map(([semester, items]) => (
              <div key={semester}>
                <div className="flex items-end justify-between mb-6 pb-3 border-b border-border">
                  <div>
                    <p className="eyebrow-gold mb-1">Semester</p>
                    <h2 className="font-serif text-2xl font-semibold tracking-tight">
                      {semester}
                    </h2>
                  </div>
                  <span className="text-xs text-muted-foreground tnum">
                    {items.length} pitch{items.length === 1 ? "" : "es"}
                  </span>
                </div>

                <ul className="grid gap-px bg-border border border-border md:grid-cols-2">
                  {items.map((p) => (
                    <li key={p.slug}>
                      <PitchCard pitch={p} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function PitchCard({
  pitch,
}: {
  pitch: Awaited<ReturnType<typeof getAllPitches>>[number];
}) {
  const fm = pitch.frontmatter;
  return (
    <Link
      href={`/pitches/${pitch.slug}`}
      className="group bg-card hover:bg-secondary/40 transition-colors p-7 flex flex-col gap-5 h-full"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-3xl font-semibold tracking-tight tnum">
              {fm.ticker}
            </span>
            <RecommendationBadge recommendation={fm.recommendation} />
          </div>
          <p className="font-serif text-base text-foreground/85 mt-1">
            {fm.title}
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="eyebrow">{fm.sector}</span>
        <span>·</span>
        <span>{fm.team}</span>
        <span>·</span>
        <span className="tnum">{formatDate(fm.date)}</span>
      </div>

      <ol className="space-y-2 mt-1 text-sm leading-relaxed text-foreground/85">
        {fm.keyTakeaways.slice(0, 3).map((t, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="font-mono text-[10px] text-gold tnum mt-1.5">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ol>

      <div className="mt-auto pt-4 border-t border-border/70 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Users className="h-3 w-3" />
        <span className="line-clamp-1">{fm.analysts.join(" · ")}</span>
      </div>
    </Link>
  );
}
