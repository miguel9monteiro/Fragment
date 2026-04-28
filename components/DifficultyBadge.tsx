import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/types";

const config: Record<
  Difficulty,
  { label: string; dot: string; ring: string; text: string }
> = {
  beginner: {
    label: "Beginner",
    dot: "bg-success",
    ring: "border-success/30",
    text: "text-success",
  },
  intermediate: {
    label: "Intermediate",
    dot: "bg-gold",
    ring: "border-gold/30",
    text: "text-gold",
  },
  advanced: {
    label: "Advanced",
    dot: "bg-destructive",
    ring: "border-destructive/30",
    text: "text-destructive",
  },
};

export function DifficultyBadge({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  const c = config[difficulty];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        c.ring,
        c.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}
