import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  GraduationCap,
  Globe,
  LineChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { LibraryItemCard } from "@/components/LibraryItemCard";
import { RecommendationBadge } from "@/components/RecommendationBadge";
import {
  getAllPitches,
  getSessions,
  getMacro,
  getQuant,
  getFeaturedLibrary,
} from "@/lib/content";
import { formatDate } from "@/lib/utils";

const CATEGORIES = [
  {
    href: "/pitches",
    label: "Stock pitches",
    description:
      "Annotated walkthroughs of past and current investment pitches. Read like a senior member would in Q&A.",
    icon: FileText,
  },
  {
    href: "/sessions",
    label: "Learning sessions",
    description:
      "Lessons on the methods, frameworks, and standards the club uses to produce defensible analysis.",
    icon: GraduationCap,
  },
  {
    href: "/macro",
    label: "Macro outlooks",
    description:
      "Periodic readings of rates, growth, and liquidity, with the implications for portfolio positioning.",
    icon: Globe,
  },
  {
    href: "/quant",
    label: "Quant presentations",
    description:
      "Quantitative work from the club: factor models, backtesting, and applied statistical research.",
    icon: LineChart,
  },
] as const;

export default async function HomePage() {
  const [pitches, sessions, macro, quant, featured] = await Promise.all([
    getAllPitches(),
    getSessions(),
    getMacro(),
    getQuant(),
    getFeaturedLibrary(),
  ]);

  const counts: Record<string, number> = {
    "/pitches": pitches.length,
    "/sessions": sessions.length,
    "/macro": macro.length,
    "/quant": quant.length,
  };

  const latestPitch = pitches[0];
  const recentLibrary = (
    featured.length > 0 ? featured : [...sessions, ...macro, ...quant]
  )
    .sort(
      (a, b) =>
        new Date(b.frontmatter.date).getTime() -
        new Date(a.frontmatter.date).getTime(),
    )
    .slice(0, 3);

  const totalItems =
    pitches.length + sessions.length + macro.length + quant.length;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <HeroBackdrop />
        <div className="absolute inset-0 grain pointer-events-none" aria-hidden />
        <div className="container relative py-20 lg:py-28">
          <div className="max-w-3xl">
            <p className="eyebrow-accent mb-6 inline-flex items-center gap-2">
              <span className="h-px w-6 bg-steel" />
              Portfolio Management Club · Nova SBE
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-[64px] font-bold leading-[1.05] tracking-tight text-balance">
              The reference library for{" "}
              <span className="italic text-steel">PMC equity research</span>.
            </h1>
            <p className="mt-7 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Stock pitches, learning sessions, macro outlooks, and quant
              presentations — assembled so members produce sharper analysis and
              defend it confidently in Q&amp;A.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/pitches">
                  Browse pitches
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/sessions">Learning sessions</Link>
              </Button>
            </div>

            <dl className="mt-14 grid grid-cols-4 gap-8 max-w-xl border-t border-border pt-7">
              <Stat label="Pitches" value={pitches.length} />
              <Stat label="Sessions" value={sessions.length} />
              <Stat label="Macro" value={macro.length} />
              <Stat label="Quant" value={quant.length} />
            </dl>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container py-20">
        <SectionHeading
          eyebrow="Library"
          title="Four kinds of material"
          description="Each category mirrors the work the club actually produces — keeping pitches, teaching, macro views, and quant research in their right rooms."
        />
        <div className="grid gap-px bg-border border border-border sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group bg-card p-7 hover:bg-secondary/60 transition-colors flex flex-col gap-5 min-h-[220px]"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary/[0.06] text-primary">
                  <c.icon className="h-4 w-4" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight leading-snug">
                  {c.label}
                </p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {c.description}
                </p>
              </div>
              <div className="mt-auto pt-4 border-t border-border/70 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="tnum">
                  {counts[c.href] ?? 0}{" "}
                  {(counts[c.href] ?? 0) === 1 ? "item" : "items"}
                </span>
                <span className="eyebrow group-hover:text-steel transition-colors">
                  Open
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest pitch */}
      {latestPitch && (
        <section className="container py-20 border-t border-border">
          <SectionHeading
            eyebrow="From the archive"
            title="Latest pitch"
            description="The most recent investment pitch from the club, presented as a teaching walkthrough."
            link={{ href: "/pitches", label: "All pitches" }}
          />
          <Link
            href={`/pitches/${latestPitch.slug}`}
            className="group block border border-border hover:bg-secondary/40 transition-colors"
          >
            <div className="grid gap-0 md:grid-cols-[1.2fr_2fr]">
              <div className="bg-primary text-primary-foreground p-8 md:p-10 flex flex-col justify-between gap-6">
                <div>
                  <p className="eyebrow text-primary-foreground/70">
                    {latestPitch.frontmatter.semester} ·{" "}
                    {latestPitch.frontmatter.team}
                  </p>
                  <p className="text-[42px] sm:text-[56px] leading-[0.95] tracking-tight font-bold mt-4 tnum">
                    {latestPitch.frontmatter.ticker}
                  </p>
                  <p className="text-xl mt-3 text-primary-foreground/85">
                    {latestPitch.frontmatter.title}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <RecommendationBadge
                    recommendation={latestPitch.frontmatter.recommendation}
                    className="bg-background/10 text-primary-foreground border-primary-foreground/20"
                  />
                  <span className="text-xs text-primary-foreground/70 tnum">
                    {formatDate(latestPitch.frontmatter.date)}
                  </span>
                </div>
              </div>

              <div className="p-8 md:p-10 flex flex-col gap-6">
                <p className="eyebrow-accent">Key takeaways</p>
                <ol className="space-y-4 text-[15px] leading-relaxed">
                  {latestPitch.frontmatter.keyTakeaways
                    .slice(0, 3)
                    .map((t, i) => (
                      <li key={i} className="flex items-start gap-4">
                        <span className="mt-1 tnum text-steel text-xs">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-foreground/90">{t}</span>
                      </li>
                    ))}
                </ol>
                <div className="mt-auto inline-flex items-center gap-2 text-sm font-medium group-hover:text-steel transition-colors">
                  Read the teaching walkthrough{" "}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Recent / featured from the library */}
      {recentLibrary.length > 0 && (
        <section className="container py-20 border-t border-border">
          <SectionHeading
            eyebrow="Recently published"
            title="From across the library"
            description="The newest pieces from sessions, macro, and quant — sorted by date."
          />
          <div className="grid gap-px bg-border border border-border md:grid-cols-2 lg:grid-cols-3">
            {recentLibrary.map((item) => (
              <LibraryItemCard
                key={`${item.kind}-${item.slug}`}
                item={item}
                className="border-0"
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state when there's no content at all */}
      {totalItems === 0 && (
        <section className="container py-24 border-t border-border">
          <div className="border border-dashed border-border p-12 text-center rounded-sm max-w-2xl mx-auto">
            <p className="eyebrow-accent mb-3">Awaiting first publication</p>
            <p className="text-xl font-semibold mb-3">
              The library is ready, the rooms are empty.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Add a pitch, session, macro outlook, or quant presentation under{" "}
              <code className="text-xs">/content</code> to see it appear here.
              See{" "}
              <Link href="/contribute" className="underline decoration-steel/60">
                Contribute
              </Link>{" "}
              for the authoring guide.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="eyebrow text-muted-foreground/70">{label}</dt>
      <dd className="mt-1 text-3xl font-bold tracking-tight tnum">{value}</dd>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  link,
}: {
  eyebrow: string;
  title: string;
  description: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
      <div className="max-w-2xl">
        <p className="eyebrow-accent mb-3">{eyebrow}</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
          {title}
        </h2>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      {link && (
        <Link
          href={link.href}
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-steel transition-colors"
        >
          {link.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
