import type { Metadata } from "next";
import Link from "next/link";
import { Github, BookOpen, FileText, Hash, GitPullRequest, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Contribute",
  description:
    "How to contribute modules, pitches, and glossary terms to the PMC knowledge platform.",
};

export default function ContributePage() {
  return (
    <>
      <section className="container pt-12 pb-10 border-b border-border">
        <p className="eyebrow-accent mb-3">For members</p>
        <h1 className="font-bold text-4xl sm:text-5xl font-semibold tracking-tight leading-tight">
          Contribute to the library
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
          Every module, pitch annotation, and glossary term lives as plain
          markdown in a public repository. To add or improve content, fork the
          repo, write your MDX, and open a pull request — two senior members
          review and merge.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <a
              href="https://github.com/miguel9monteiro/Fragment"
              target="_blank"
              rel="noreferrer"
            >
              <Github className="h-4 w-4" />
              Open the repository
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#how-to">
              How to contribute <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* Process */}
      <section className="container py-16">
        <p className="eyebrow-accent mb-3">Workflow</p>
        <h2 className="text-3xl font-semibold tracking-tight mb-10">
          Three steps from idea to published
        </h2>
        <ol className="grid gap-px bg-border border border-border md:grid-cols-3">
          <Step
            number="01"
            title="Fork & branch"
            body="Fork the repository on GitHub and create a feature branch for your contribution."
          />
          <Step
            number="02"
            title="Write & preview"
            body="Add your MDX in /content. Run pnpm dev locally to preview before submitting."
          />
          <Step
            number="03"
            title="PR & review"
            body="Open a pull request. Two senior members review for accuracy, clarity, and consistency."
          />
        </ol>
      </section>

      {/* What you can add */}
      <section id="how-to" className="container py-16 border-t border-border">
        <p className="eyebrow-accent mb-3">What you can add</p>
        <h2 className="text-3xl font-semibold tracking-tight mb-10">
          Three content types
        </h2>

        <div className="grid gap-px bg-border border border-border md:grid-cols-3">
          <ContentType
            icon={BookOpen}
            label="Module"
            title="A learning module"
            location="/content/modules/<category>/<slug>.mdx"
            body="A focused lesson on one concept. Use Callouts, SelfChecks, DeepDives, and FormulaBlocks. Aim for 8–15 minutes of read time."
          />
          <ContentType
            icon={FileText}
            label="Pitch"
            title="A pitch teaching page"
            location="/content/pitches/<semester>/<ticker>/index.mdx"
            body="A teaching walkthrough of a past pitch — annotated slides, the senior questions, what the team learned answering them."
          />
          <ContentType
            icon={Hash}
            label="Term"
            title="A glossary entry"
            location="/content/glossary/terms.json"
            body="A short, precise definition of a term used across the library. Two sentences max. Link the modules where it's explored further."
          />
        </div>
      </section>

      {/* Components reference */}
      <section className="container py-16 border-t border-border">
        <p className="eyebrow-accent mb-3">MDX components</p>
        <h2 className="text-3xl font-semibold tracking-tight mb-3">
          Building blocks
        </h2>
        <p className="text-muted-foreground max-w-2xl leading-relaxed mb-10">
          Every module and pitch page can use these components inside MDX. Full
          usage examples live in <code className="tnum text-xs">CONTRIBUTING.md</code>.
        </p>

        <div className="grid gap-px bg-border border border-border md:grid-cols-2 lg:grid-cols-3">
          {COMPONENTS.map((c) => (
            <div key={c.name} className="bg-card p-5">
              <p className="tnum text-xs text-steel mb-2">{c.name}</p>
              <p className="text-base font-semibold mb-1">
                {c.title}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {c.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Review process */}
      <section className="container py-16 border-t border-border">
        <div className="grid gap-12 md:grid-cols-2 items-start">
          <div>
            <p className="eyebrow-accent mb-3 inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Review
            </p>
            <h2 className="text-3xl font-semibold tracking-tight mb-5">
              Two senior approvals to merge
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We protect the bar with people, not gates. Every PR needs two
              senior member approvals before it merges. Reviewers check
              accuracy of finance content, clarity of writing, correct use of
              the MDX components, and consistency with existing style.
            </p>
          </div>
          <div className="border border-border p-6 rounded-sm bg-secondary/40">
            <p className="eyebrow mb-4 inline-flex items-center gap-1.5">
              <GitPullRequest className="h-3 w-3" />
              What reviewers look for
            </p>
            <ul className="space-y-3 text-sm leading-relaxed">
              <li className="flex gap-3">
                <span className="tnum text-[10px] text-steel tnum mt-1.5">
                  01
                </span>
                Numbers tie out — every figure has a source or a calculation.
              </li>
              <li className="flex gap-3">
                <span className="tnum text-[10px] text-steel tnum mt-1.5">
                  02
                </span>
                Concepts are introduced before they're used.
              </li>
              <li className="flex gap-3">
                <span className="tnum text-[10px] text-steel tnum mt-1.5">
                  03
                </span>
                Self-checks test understanding, not memorization.
              </li>
              <li className="flex gap-3">
                <span className="tnum text-[10px] text-steel tnum mt-1.5">
                  04
                </span>
                Tone is professional and confident — never breezy.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20 border-t border-border">
        <div className="max-w-2xl">
          <p className="eyebrow-accent mb-3">Ready?</p>
          <h2 className="text-3xl font-semibold tracking-tight mb-4">
            Read{" "}
            <Link
              href="https://github.com/miguel9monteiro/Fragment/blob/main/CONTRIBUTING.md"
              className="underline decoration-steel/60 underline-offset-4 hover:decoration-steel"
            >
              CONTRIBUTING.md
            </Link>{" "}
            for the full authoring guide.
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            It includes copy-pasteable templates, full examples of every
            component, naming conventions, and the review checklist.
          </p>
        </div>
      </section>
    </>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-card p-7 flex flex-col gap-3">
      <p className="tnum text-xs text-steel tnum">{number}</p>
      <p className="text-xl font-semibold tracking-tight">
        {title}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function ContentType({
  icon: Icon,
  label,
  title,
  location,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  location: string;
  body: string;
}) {
  return (
    <div className="bg-card p-7 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-steel" />
        <span className="eyebrow-accent">{label}</span>
      </div>
      <p className="text-xl font-semibold tracking-tight">
        {title}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      <p className="tnum text-[11px] text-foreground/70 mt-auto pt-3 border-t border-border/70 break-all">
        {location}
      </p>
    </div>
  );
}

const COMPONENTS = [
  {
    name: "<Callout>",
    title: "Pulled-out box",
    description:
      "Surface a key insight, a warning, a self-question, or a definition. Four variants.",
  },
  {
    name: "<SelfCheck>",
    title: "Collapsible self-test",
    description:
      "Question shown, answer hidden until clicked. The only interactive learning element in v1.",
  },
  {
    name: "<DeepDive>",
    title: "For the curious",
    description:
      "Optional deeper section that doesn't break the main reading flow.",
  },
  {
    name: "<KeyTerm>",
    title: "Inline glossary link",
    description:
      "Hover shows the short definition; click jumps to the glossary entry.",
  },
  {
    name: "<FormulaBlock>",
    title: "Rendered LaTeX",
    description:
      "KaTeX-rendered math for DCF, WACC, CAPM, and other equations.",
  },
  {
    name: "<PitchSlide>",
    title: "Annotated slide",
    description:
      "A slide image with positioned hotspots. Hover or tap to reveal teaching commentary.",
  },
  {
    name: "<MetricsTable>",
    title: "Finance table",
    description:
      "Right-aligned, monospace tabular figures, with optional row highlighting.",
  },
  {
    name: "<ProsCons>",
    title: "Catalysts vs risks",
    description:
      "Side-by-side layout mirroring the Investment Thesis slide format.",
  },
];
