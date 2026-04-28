"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ASSET_CLASS_LABELS,
  POLL_ASSET_CLASSES,
  type Poll,
  type PollAssetClass,
  type PollForum,
} from "@/lib/types";
import { VoteBar, VoteLegend, kindColors } from "@/components/VoteBar";
import { cn, formatDate } from "@/lib/utils";

/** The current semester at the time of writing — drives the default filter. */
const CURRENT_SEMESTER = "Spring 2026";

type SemesterFilter = string; // "all" | "Spring 2026" | ...
type AssetFilter = "all" | PollAssetClass;
type ForumFilter = "all" | PollForum;

/* -------------------------------------------------------------------------- */
/*  Outcome derivation                                                        */
/* -------------------------------------------------------------------------- */

/** The option(s) with the most votes, with their share of the total. */
function deriveOutcome(poll: Poll) {
  const total = poll.options.reduce((s, o) => s + o.count, 0);
  const max = Math.max(...poll.options.map((o) => o.count));
  const winners = poll.options.filter((o) => o.count === max);
  const tied = winners.length > 1;
  const winShare = total > 0 ? max / total : 0;
  // Conviction = margin between top option and runner-up, normalised.
  const sorted = [...poll.options].sort((a, b) => b.count - a.count);
  const margin = (sorted[0]?.count ?? 0) - (sorted[1]?.count ?? 0);
  const conviction = total > 0 ? margin / total : 0;
  // Whether the proposing motion was approved.
  const proposingKind =
    poll.motionType === "entry"
      ? "buy"
      : poll.motionType === "exit"
        ? "sell"
        : "increase";
  const proposing = poll.options.find((o) => o.kind === proposingKind);
  const motionApproved =
    !tied && proposing != null && proposing.count === max;

  return {
    total,
    winners,
    tied,
    winShare,
    conviction,
    motionApproved,
  };
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function VotingsClient({ polls }: { polls: Poll[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const semesters = useMemo(() => {
    const seen = new Set<string>();
    for (const p of polls) seen.add(p.semester);
    return [...seen].sort((a, b) => {
      // Newest semester first; comparing as dates of any poll in that semester.
      const da = polls.find((p) => p.semester === a)?.date ?? "";
      const db = polls.find((p) => p.semester === b)?.date ?? "";
      return db.localeCompare(da);
    });
  }, [polls]);

  const initialSemester =
    searchParams.get("semester") ??
    (semesters.includes(CURRENT_SEMESTER) ? CURRENT_SEMESTER : "all");
  const initialAsset = (searchParams.get("asset") as AssetFilter) || "all";
  const initialForum = (searchParams.get("forum") as ForumFilter) || "all";

  const [semester, setSemester] = useState<SemesterFilter>(initialSemester);
  const [asset, setAsset] = useState<AssetFilter>(initialAsset);
  const [forum, setForum] = useState<ForumFilter>(initialForum);

  useEffect(() => {
    const params = new URLSearchParams();
    if (semester !== CURRENT_SEMESTER) params.set("semester", semester);
    if (asset !== "all") params.set("asset", asset);
    if (forum !== "all") params.set("forum", forum);
    const qs = params.toString();
    router.replace(qs ? `/votings?${qs}` : "/votings", { scroll: false });
  }, [semester, asset, forum, router]);

  const filtered = useMemo(() => {
    return polls.filter((p) => {
      if (semester !== "all" && p.semester !== semester) return false;
      if (asset !== "all" && p.assetClass !== asset) return false;
      if (forum !== "all" && p.forum !== forum) return false;
      return true;
    });
  }, [polls, semester, asset, forum]);

  /* -------------------- Stats over the current filter -------------------- */
  const stats = useMemo(() => {
    const totalPolls = filtered.length;
    const totalVotes = filtered.reduce(
      (s, p) => s + p.options.reduce((s2, o) => s2 + o.count, 0),
      0,
    );

    let approved = 0;
    let counted = 0;
    let tightest: { poll: Poll; conviction: number } | null = null;
    let landslide: { poll: Poll; conviction: number } | null = null;

    for (const p of filtered) {
      const o = deriveOutcome(p);
      if (!o.tied && o.total > 0) {
        counted++;
        if (o.motionApproved) approved++;
      }
      if (
        tightest == null ||
        o.conviction < tightest.conviction
      ) {
        tightest = { poll: p, conviction: o.conviction };
      }
      if (
        landslide == null ||
        o.conviction > landslide.conviction
      ) {
        landslide = { poll: p, conviction: o.conviction };
      }
    }

    const approvalRate = counted > 0 ? approved / counted : 0;
    return { totalPolls, totalVotes, approvalRate, tightest, landslide };
  }, [filtered]);

  /* -------------------- Group by semester for display -------------------- */
  const grouped = useMemo(() => {
    const map = new Map<string, Poll[]>();
    for (const p of filtered) {
      const arr = map.get(p.semester) ?? [];
      arr.push(p);
      map.set(p.semester, arr);
    }
    // Each semester's polls newest-first.
    for (const arr of map.values())
      arr.sort((a, b) => b.date.localeCompare(a.date));
    return [...map.entries()].sort((a, b) => {
      const da = a[1][0]?.date ?? "";
      const db = b[1][0]?.date ?? "";
      return db.localeCompare(da);
    });
  }, [filtered]);

  return (
    <>
      {/* Hero */}
      <section className="container pt-12 pb-10 border-b border-border">
        <p className="eyebrow-accent mb-3">Voting record</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Votings
        </h1>
        <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
          Every poll the club has voted on. Filter by semester, asset class,
          or forum. Defaults to the current semester ({CURRENT_SEMESTER}) —
          switch to "All" to see the full record.
        </p>
      </section>

      {/* Filter bar */}
      <section className="sticky top-16 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="container py-4 flex flex-col gap-3">
          <FilterRow label="Semester">
            <Chip
              active={semester === "all"}
              onClick={() => setSemester("all")}
            >
              All time
            </Chip>
            {semesters.map((s) => (
              <Chip
                key={s}
                active={semester === s}
                onClick={() => setSemester(s)}
              >
                {s}
                {s === CURRENT_SEMESTER && (
                  <span className="ml-1.5 text-[9px] uppercase tracking-wider opacity-70">
                    current
                  </span>
                )}
              </Chip>
            ))}
          </FilterRow>

          <FilterRow label="Asset class">
            <Chip active={asset === "all"} onClick={() => setAsset("all")}>
              All assets
            </Chip>
            {POLL_ASSET_CLASSES.map((a) => (
              <Chip
                key={a}
                active={asset === a}
                onClick={() => setAsset(a)}
              >
                {ASSET_CLASS_LABELS[a]}
              </Chip>
            ))}
          </FilterRow>

          <FilterRow label="Forum">
            <Chip active={forum === "all"} onClick={() => setForum("all")}>
              All forums
            </Chip>
            <Chip active={forum === "main"} onClick={() => setForum("main")}>
              Main floor
            </Chip>
            <Chip
              active={forum === "extended-board"}
              onClick={() => setForum("extended-board")}
            >
              Extended Board
            </Chip>
          </FilterRow>
        </div>
      </section>

      {/* Stats panel */}
      <section className="container py-10 border-b border-border">
        <div className="grid gap-px bg-border border border-border sm:grid-cols-2 lg:grid-cols-4">
          <StatCell label="Polls" value={stats.totalPolls.toString()} />
          <StatCell
            label="Votes cast"
            value={stats.totalVotes.toLocaleString()}
          />
          <StatCell
            label="Approval rate"
            value={
              stats.totalPolls === 0
                ? "—"
                : `${Math.round(stats.approvalRate * 100)}%`
            }
            caption="motions where the proposed action carried"
          />
          <StatCell
            label="Most contested"
            value={
              stats.tightest == null
                ? "—"
                : stats.tightest.poll.subject
            }
            caption={
              stats.tightest == null
                ? undefined
                : `${Math.round(stats.tightest.conviction * 100)}% conviction · ${formatDate(stats.tightest.poll.date)}`
            }
          />
        </div>
      </section>

      {/* Grouped list */}
      <section className="container py-12">
        {filtered.length === 0 ? (
          <div className="border border-dashed border-border py-20 text-center rounded-sm">
            <p className="text-xl font-semibold mb-2">No polls match.</p>
            <p className="text-sm text-muted-foreground">
              Try clearing a filter.
            </p>
          </div>
        ) : (
          <div className="space-y-14">
            {grouped.map(([sem, items]) => (
              <div key={sem}>
                <div className="mb-6 pb-3 border-b border-border flex items-end justify-between gap-4">
                  <div>
                    <p className="eyebrow-accent mb-1">Semester</p>
                    <h2 className="text-2xl font-bold tracking-tight">
                      {sem}
                    </h2>
                  </div>
                  <span className="text-xs text-muted-foreground tnum">
                    {items.length} poll{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ol className="border border-border divide-y divide-border bg-card">
                  {items.map((p) => (
                    <li key={p.slug}>
                      <PollRow poll={p} />
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="eyebrow w-24 shrink-0 text-muted-foreground/70 hidden md:block">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5 flex-1 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 px-3 rounded-sm border text-[12px] font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border bg-background text-foreground/80 hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function StatCell({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="bg-card p-6 flex flex-col gap-1.5">
      <p className="eyebrow text-muted-foreground/70">{label}</p>
      <p className="text-3xl font-bold tracking-tight tnum text-primary leading-none">
        {value}
      </p>
      {caption && (
        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
          {caption}
        </p>
      )}
    </div>
  );
}

function PollRow({ poll }: { poll: Poll }) {
  const outcome = deriveOutcome(poll);
  const winner = outcome.winners[0];
  const winColors = winner ? kindColors(winner.kind) : null;
  const winPct = Math.round(outcome.winShare * 100);
  const convictionPct = Math.round(outcome.conviction * 100);

  return (
    <div className="px-5 py-5 sm:px-7 sm:py-6 hover:bg-secondary/40 transition-colors">
      {/* Top line — date · subject · meta · verdict */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-baseline gap-4 flex-wrap">
          <span className="eyebrow text-muted-foreground/70 tnum w-16 shrink-0">
            {compactDate(poll.date)}
          </span>
          <span className="text-lg sm:text-xl font-bold tracking-tight">
            {poll.subject}
          </span>
          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="eyebrow">
              {ASSET_CLASS_LABELS[poll.assetClass]}
            </span>
            <span aria-hidden>·</span>
            <span>
              {poll.forum === "extended-board"
                ? "Extended Board"
                : "Main floor"}
            </span>
            {poll.motion && (
              <>
                <span aria-hidden>·</span>
                <span className="italic text-muted-foreground/80">
                  {poll.motion}
                </span>
              </>
            )}
          </span>
        </div>

        <div className="text-right shrink-0">
          {outcome.tied ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-warning/40 bg-warning/10 text-warning text-[11px] font-semibold uppercase tracking-wider">
              Tied {winPct}%
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] font-semibold uppercase tracking-wider",
                winColors?.text,
                winColors?.bg.replace("bg-", "bg-") + "/10",
                winColors
                  ? winColors.dot.replace("bg-", "border-") + "/30"
                  : "border-border",
              )}
            >
              {winner?.label} {winPct}%
            </span>
          )}
        </div>
      </div>

      {/* Vote bar */}
      <VoteBar options={poll.options} />

      {/* Bottom line — legend with counts/pcts | conviction & total */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <VoteLegend options={poll.options} />
        <span className="text-[11px] text-muted-foreground tnum whitespace-nowrap">
          {outcome.total} votes
          <span className="mx-1.5 opacity-60">·</span>
          {convictionPct}% conv
        </span>
      </div>
    </div>
  );
}

/** Compact date formatter — "15 Apr" style, no year (year is in the section header). */
function compactDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}
