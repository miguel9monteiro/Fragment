import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/types";

const config: Record<Recommendation, { ring: string; text: string }> = {
  BUY: { ring: "border-success/30 bg-success/8", text: "text-success" },
  HOLD: { ring: "border-border bg-muted", text: "text-muted-foreground" },
  SELL: {
    ring: "border-destructive/30 bg-destructive/8",
    text: "text-destructive",
  },
};

export function RecommendationBadge({
  recommendation,
  className,
}: {
  recommendation: Recommendation;
  className?: string;
}) {
  const c = config[recommendation];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
        c.ring,
        c.text,
        className,
      )}
    >
      {recommendation}
    </span>
  );
}
