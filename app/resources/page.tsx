import type { Metadata } from "next";
import Link from "next/link";
import {
  Youtube,
  ListVideo,
  PlayCircle,
  FileText,
  BookOpen,
  Globe,
  Mic,
  ArrowUpRight,
  GitPullRequestArrow,
} from "lucide-react";
import { getResources } from "@/lib/content";
import {
  RESOURCE_TYPE_LABELS,
  type ResourceItem,
  type ResourceType,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Curated external resources — courses, channels, articles, and books — contributed by PMC members.",
};

const RESOURCE_ICONS: Record<
  ResourceType,
  React.ComponentType<{ className?: string }>
> = {
  "youtube-channel": Youtube,
  "youtube-playlist": ListVideo,
  "youtube-video": PlayCircle,
  article: FileText,
  website: Globe,
  book: BookOpen,
  podcast: Mic,
};

export default async function ResourcesPage() {
  const topics = await getResources();
  const totalResources = topics.reduce((s, t) => s + t.resources.length, 0);

  return (
    <>
      <section className="container pt-12 pb-10 border-b border-border">
        <p className="eyebrow-accent mb-3">Resources</p>
        <h1 className="font-bold text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
          Curated resources
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
          Courses, channels, articles, and books members swear by — grouped by
          theme, attributed to whoever brought them in. The reading list a
          senior member would hand a new analyst on day one.
        </p>

        <div className="mt-6 flex items-start gap-2.5 max-w-2xl border-l-2 border-steel bg-secondary/30 px-4 py-3 rounded-sm">
          <BookOpen className="h-4 w-4 mt-0.5 shrink-0 text-steel" />
          <p className="text-sm text-foreground/85 leading-relaxed">
            <span className="font-semibold">For any book listed below</span>,
            the PDF is already in the club&apos;s internal Teams workspace —
            Goodreads links are for context, not for purchase.
          </p>
        </div>

        {topics.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
            <span className="eyebrow text-muted-foreground">In this directory</span>
            {topics.map((t) => (
              <a
                key={t.slug}
                href={`#${t.slug}`}
                className="text-foreground/85 hover:text-foreground transition-colors"
              >
                {t.title}{" "}
                <span className="tnum text-muted-foreground">
                  ({t.resources.length})
                </span>
              </a>
            ))}
            <span className="ml-auto tnum text-[11px] text-muted-foreground">
              {totalResources} resource{totalResources === 1 ? "" : "s"} ·{" "}
              {topics.length} theme{topics.length === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </section>

      <section className="container py-14">
        {topics.length === 0 ? (
          <div className="border border-dashed border-border py-20 text-center rounded-sm">
            <p className="text-xl font-semibold mb-2">
              No resources curated yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Add the first ones to{" "}
              <code className="tnum text-xs">
                /content/resources/resources.json
              </code>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-20">
            {topics.map((topic) => (
              <div
                key={topic.slug}
                id={topic.slug}
                className="scroll-mt-24"
              >
                <div className="mb-6 pb-3 border-b border-border flex items-end justify-between gap-6">
                  <div className="min-w-0">
                    <p className="eyebrow-accent mb-1">Theme</p>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {topic.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground max-w-prose leading-relaxed">
                      {topic.description}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground tnum whitespace-nowrap">
                    {topic.resources.length} resource
                    {topic.resources.length === 1 ? "" : "s"}
                  </span>
                </div>

                <ul className="grid gap-px bg-border border border-border md:grid-cols-2">
                  {topic.resources.map((r, i) => (
                    <li key={i}>
                      <ResourceCard resource={r} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="mt-4 border border-dashed border-border bg-card px-6 py-8 sm:px-8 sm:py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div className="max-w-xl">
                <p className="eyebrow mb-2">Contribute</p>
                <p className="text-base font-semibold">
                  Found something other members should be reading?
                </p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Add to{" "}
                  <code className="tnum text-[12px]">
                    /content/resources/resources.json
                  </code>{" "}
                  with your name, role, and a short note on why it&apos;s worth
                  the time.
                </p>
              </div>
              <Link
                href="/contribute"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap rounded-sm"
              >
                <GitPullRequestArrow className="h-4 w-4" />
                How to contribute
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function ResourceCard({ resource }: { resource: ResourceItem }) {
  const Icon = RESOURCE_ICONS[resource.type];

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noreferrer"
      className="group bg-card hover:bg-secondary/40 transition-colors p-7 flex flex-col gap-4 h-full"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center border border-border bg-background shrink-0">
            <Icon className="h-4 w-4 text-foreground/80" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow text-muted-foreground mb-1">
              {RESOURCE_TYPE_LABELS[resource.type]}
            </p>
            <p className="font-bold text-base leading-snug text-foreground break-words">
              {resource.title}
            </p>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      </div>

      {resource.note && (
        <p className="text-sm text-foreground/80 leading-relaxed">
          &ldquo;{resource.note}&rdquo;
        </p>
      )}

      <div className="mt-auto pt-4 border-t border-border/70 text-[11px] text-muted-foreground">
        <span className="eyebrow text-muted-foreground/80 mr-2">
          Suggested by
        </span>
        <span className="text-foreground/85 font-medium">
          {resource.contributor}
        </span>
        {resource.contributorRole && (
          <span className="opacity-70"> · {resource.contributorRole}</span>
        )}
      </div>
    </a>
  );
}
