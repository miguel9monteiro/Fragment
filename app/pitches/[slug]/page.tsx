import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Github, FileDown, ArrowUpRight, Users } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxOptions } from "@/lib/mdx";
import { mdxComponents } from "@/components/mdx";
import { getAllPitches, getPitch, getPollForPitch } from "@/lib/content";
import { RecommendationBadge } from "@/components/RecommendationBadge";
import { ReadingProgress } from "@/components/ReadingProgress";
import { PitchOutcome } from "@/components/PitchOutcome";
import { formatDate } from "@/lib/utils";

export async function generateStaticParams() {
  const pitches = await getAllPitches();
  return pitches.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pitch = await getPitch(slug);
  if (!pitch) return {};
  return {
    title: `${pitch.frontmatter.ticker} — ${pitch.frontmatter.title}`,
    description: pitch.frontmatter.keyTakeaways.join(" · "),
  };
}

export default async function PitchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pitch = await getPitch(slug);
  if (!pitch) notFound();

  const fm = pitch.frontmatter;
  const poll = await getPollForPitch(pitch);
  const editPath = `https://github.com/miguel9monteiro/Fragment/edit/main/content/pitches/${pitch.semesterSlug}/${pitch.slug}/index.mdx`;

  return (
    <>
      <ReadingProgress />

      {/* Hero — institutional research-note style header */}
      <section className="border-b border-border bg-primary text-primary-foreground">
        <div className="container py-14 lg:py-20">
          <nav className="text-xs text-primary-foreground/65 mb-8 flex items-center gap-1.5">
            <Link
              href="/pitches"
              className="hover:text-primary-foreground transition-colors"
            >
              Pitch archive
            </Link>
            <span aria-hidden>/</span>
            <span>{fm.semester}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:items-end">
            <div>
              <p className="eyebrow text-primary-foreground/65 mb-3">
                {fm.sector}
              </p>
              <p className="font-bold text-[80px] sm:text-[100px] leading-[0.9] tracking-tight font-semibold">
                {fm.ticker}
              </p>
              <p className="font-bold text-xl mt-3 text-primary-foreground/85">
                {fm.title}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <RecommendationBadge
                  recommendation={fm.recommendation}
                  className="bg-background/10 text-primary-foreground border-primary-foreground/20"
                />
                <span className="text-xs text-primary-foreground/65 tnum">
                  {formatDate(fm.date)}
                </span>
                <span className="text-xs text-primary-foreground/65">
                  · {fm.team}
                </span>
              </div>
            </div>

            <div className="lg:pl-12 lg:border-l lg:border-primary-foreground/15">
              <p className="eyebrow text-steel mb-4">Key takeaways</p>
              <ol className="space-y-4">
                {fm.keyTakeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="mt-1 tnum text-steel text-xs tnum shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[15px] leading-relaxed text-primary-foreground/90">
                      {t}
                    </span>
                  </li>
                ))}
              </ol>

              <div className="mt-8 pt-5 border-t border-primary-foreground/15 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-primary-foreground/65">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  {fm.analysts.join(" · ")}
                </span>
                {fm.sourcePdfUrl && (
                  <a
                    href={fm.sourcePdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-primary-foreground transition-colors"
                  >
                    <FileDown className="h-3 w-3" />
                    Original deck (PDF)
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Teaching walkthrough */}
      <section className="container py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_3fr]">
          <aside className="hidden lg:block sticky top-24 self-start">
            <p className="eyebrow mb-3">Teaching walkthrough</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This is not a reproduction of the deck. It is the questions a
              senior member would ask while reading it — and what the team
              learned answering them.
            </p>
          </aside>

          <article className="prose-pmc max-w-prose mx-auto w-full">
            <MDXRemote
              source={pitch.source}
              components={mdxComponents}
              options={{ mdxOptions, parseFrontmatter: false }}
            />

            {poll && <PitchOutcome poll={poll} />}

            <hr />

            <div className="not-prose mt-10">
              <a
                href={editPath}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-3.5 w-3.5" />
                Improve this walkthrough on GitHub
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
