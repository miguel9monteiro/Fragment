import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModuleCard } from "@/components/ModuleCard";
import { RecommendationBadge } from "@/components/RecommendationBadge";
import {
  getAllModules,
  getAllPitches,
  getFeaturedModules,
} from "@/lib/content";
import { CATEGORY_LABELS, MODULE_CATEGORIES } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default async function HomePage() {
  const [allModules, featured, pitches] = await Promise.all([
    getAllModules(),
    getFeaturedModules(),
    getAllPitches(),
  ]);

  // If nothing is explicitly featured, surface the most-recently-updated four.
  const featuredList =
    featured.length > 0
      ? featured.slice(0, 4)
      : [...allModules]
          .sort(
            (a, b) =>
              new Date(b.frontmatter.lastUpdated).getTime() -
              new Date(a.frontmatter.lastUpdated).getTime(),
          )
          .slice(0, 4);

  const latestPitch = pitches[0];

  const categoryCounts: Record<string, number> = {};
  for (const m of allModules) {
    categoryCounts[m.category] = (categoryCounts[m.category] ?? 0) + 1;
  }

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 grain pointer-events-none" aria-hidden />
        <div className="container relative py-20 lg:py-28">
          <div className="max-w-3xl">
            <p className="eyebrow-gold mb-6 inline-flex items-center gap-2">
              <span className="h-px w-6 bg-gold" />
              Portfolio Management Club · Nova SBE
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-[64px] font-semibold leading-[1.05] tracking-tight text-balance">
              The reference library for{" "}
              <span className="italic text-gold">PMC equity research</span>.
            </h1>
            <p className="mt-7 text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Structured modules, an annotated archive of past pitches, and a
              shared vocabulary — built so members produce sharper analysis and
              defend it confidently in Q&amp;A.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/modules">
                  Browse modules
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pitches">Pitch archive</Link>
              </Button>
            </div>

            <dl className="mt-14 grid grid-cols-3 gap-8 max-w-md border-t border-border pt-7">
              <Stat label="Modules" value={allModules.length} />
              <Stat label="Pitches" value={pitches.length} />
              <Stat
                label="Categories"
                value={MODULE_CATEGORIES.length}
              />
            </dl>
          </div>
        </div>
      </section>

      {/* Featured modules */}
      <section className="container py-20">
        <SectionHeading
          eyebrow="Featured"
          title="Start with these"
          description="Curated entry points into the library — the modules every member should read first."
          link={{ href: "/modules", label: "All modules" }}
          icon={Sparkles}
        />
        {featuredList.length > 0 ? (
          <div className="grid gap-px bg-border md:grid-cols-2 lg:grid-cols-4 border border-border">
            {featuredList.map((m) => (
              <ModuleCard
                key={`${m.category}-${m.slug}`}
                module={m}
                className="border-0"
              />
            ))}
          </div>
        ) : (
          <EmptyState>No modules yet. Add MDX files in <code>/content/modules</code>.</EmptyState>
        )}
      </section>

      {/* Latest pitch */}
      {latestPitch && (
        <section className="container py-20 border-t border-border">
          <SectionHeading
            eyebrow="From the archive"
            title="Latest pitch"
            description="The most recent investment pitch from the club, presented as a teaching walkthrough."
            link={{ href: "/pitches", label: "All pitches" }}
            icon={FileText}
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
                  <p className="font-serif text-[42px] sm:text-[56px] leading-[0.95] tracking-tight font-semibold mt-4">
                    {latestPitch.frontmatter.ticker}
                  </p>
                  <p className="font-serif text-xl mt-3 text-primary-foreground/85">
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
                <p className="eyebrow-gold">Key takeaways</p>
                <ol className="space-y-4 text-[15px] leading-relaxed">
                  {latestPitch.frontmatter.keyTakeaways
                    .slice(0, 3)
                    .map((t, i) => (
                      <li key={i} className="flex items-start gap-4">
                        <span className="mt-1 font-mono text-gold text-xs tnum">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-foreground/90">{t}</span>
                      </li>
                    ))}
                </ol>
                <div className="mt-auto inline-flex items-center gap-2 text-sm font-medium group-hover:text-gold transition-colors">
                  Read the teaching walkthrough{" "}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Browse by topic */}
      <section className="container py-20 border-t border-border">
        <SectionHeading
          eyebrow="Library"
          title="Browse by topic"
          description="Eight disciplines that together make up the equity research toolkit."
          icon={BookOpen}
        />
        <div className="grid gap-px bg-border border border-border sm:grid-cols-2 lg:grid-cols-4">
          {MODULE_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/modules?category=${c}`}
              className="group bg-card p-6 hover:bg-secondary/60 transition-colors flex flex-col justify-between min-h-[140px]"
            >
              <p className="font-serif text-lg font-semibold tracking-tight leading-snug">
                {CATEGORY_LABELS[c]}
              </p>
              <div className="flex items-center justify-between mt-6">
                <span className="text-xs text-muted-foreground tnum">
                  {categoryCounts[c] ?? 0}{" "}
                  {(categoryCounts[c] ?? 0) === 1 ? "module" : "modules"}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="eyebrow text-muted-foreground/70">{label}</dt>
      <dd className="mt-1 font-serif text-3xl font-semibold tracking-tight tnum">
        {value}
      </dd>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  link,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  link?: { href: string; label: string };
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
      <div className="max-w-2xl">
        <p className="eyebrow-gold inline-flex items-center gap-2 mb-3">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {eyebrow}
        </p>
        <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
          {title}
        </h2>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      {link && (
        <Link
          href={link.href}
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-gold transition-colors"
        >
          {link.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground rounded-sm">
      {children}
    </div>
  );
}
