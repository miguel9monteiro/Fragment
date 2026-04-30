import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowUpRight,
} from "lucide-react";
import type { Poll } from "@/lib/types";
import { ASSET_CLASS_LABELS } from "@/lib/types";
import { VoteBar, VoteLegend } from "@/components/VoteBar";
import { cn, formatDate } from "@/lib/utils";

/**
 * Verdict for a pitch's entry vote — derived, not stored.
 * Mirrors the logic in app/votings/VotingsClient.tsx so the two
 * surfaces always agree.
 */
function deriveOutcome(poll: Poll) {
  const total = poll.options.reduce((s, o) => s + o.count, 0);
  const sorted = [...poll.options].sort((a, b) => b.count - a.count);
  const top = sorted[0]?.count ?? 0;
  const second = sorted[1]?.count ?? 0;
  const tied = top > 0 && top === second;

  const proposingKind =
    poll.motionType === "entry"
      ? "buy"
      : poll.motionType === "exit"
        ? "sell"
        : "increase";
  const proposing = poll.options.find((o) => o.kind === proposingKind);
  const proposingCount = proposing?.count ?? 0;
  const proposingPct = total > 0 ? proposingCount / total : 0;
  const motionApproved = !tied && proposing != null && proposing.count === top;

  return { total, tied, motionApproved, proposingPct, proposing };
}

export function PitchOutcome({ poll }: { poll: Poll }) {
  const { total, tied, motionApproved, proposingPct } = deriveOutcome(poll);

  const StatusIcon = tied
    ? MinusCircle
    : motionApproved
      ? CheckCircle2
      : XCircle;

  const statusLabel = tied
    ? "Tied vote"
    : motionApproved
      ? "Motion approved"
      : "Motion rejected";

  const statusClass = tied
    ? "text-warning border-warning/40 bg-warning/10"
    : motionApproved
      ? "text-success border-success/30 bg-success/10"
      : "text-destructive border-destructive/30 bg-destructive/10";

  const headline = tied
    ? "The vote tied — no decision was carried."
    : motionApproved
      ? `Motion carried with ${Math.round(proposingPct * 100)}% in favour.`
      : `Motion did not carry — ${Math.round(proposingPct * 100)}% in favour.`;

  return (
    <aside className="not-prose mt-12 mb-2 border border-border bg-card">
      <div className="px-6 py-5 border-b border-border flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow-accent mb-2">Outcome</p>
          <p className="text-base font-semibold text-foreground leading-snug">
            {headline}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap",
            statusClass,
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {statusLabel}
        </span>
      </div>

      <div className="px-6 py-5">
        <VoteBar options={poll.options} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <VoteLegend options={poll.options} />
          <span className="text-[11px] text-muted-foreground tnum whitespace-nowrap">
            {total} votes cast
          </span>
        </div>
      </div>

      <div className="border-t border-border px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>
          Voted {formatDate(poll.date)}
          <span className="mx-1.5 opacity-60">·</span>
          {poll.forum === "extended-board" ? "Extended Board" : "Main floor"}
          <span className="mx-1.5 opacity-60">·</span>
          {ASSET_CLASS_LABELS[poll.assetClass]}
        </span>
        <Link
          href={`/votings?semester=${encodeURIComponent(poll.semester)}#${poll.slug}`}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          View in voting record
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </aside>
  );
}
