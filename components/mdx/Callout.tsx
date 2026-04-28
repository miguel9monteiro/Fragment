import * as React from "react";
import {
  Lightbulb,
  AlertTriangle,
  HelpCircle,
  BookMarked,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CalloutType = "insight" | "warning" | "question" | "definition";

const config: Record<
  CalloutType,
  {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    accent: string;
    text: string;
  }
> = {
  insight: {
    label: "Insight",
    Icon: Lightbulb,
    accent: "border-l-steel bg-steel/[0.04]",
    text: "text-steel",
  },
  warning: {
    label: "Watch out",
    Icon: AlertTriangle,
    accent: "border-l-warning bg-warning/[0.04]",
    text: "text-warning",
  },
  question: {
    label: "Ask yourself",
    Icon: HelpCircle,
    accent: "border-l-primary bg-secondary/60",
    text: "text-primary",
  },
  definition: {
    label: "Definition",
    Icon: BookMarked,
    accent: "border-l-foreground/40 bg-secondary/60",
    text: "text-foreground",
  },
};

export function Callout({
  type = "insight",
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}) {
  const c = config[type];
  return (
    <aside
      className={cn(
        "my-7 border-l-2 border-y border-r border-y-border border-r-border rounded-r-sm py-4 pl-5 pr-5 [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0",
        c.accent,
      )}
    >
      <p
        className={cn(
          "eyebrow inline-flex items-center gap-1.5 mb-2 not-italic",
          c.text,
        )}
      >
        <c.Icon className="h-3 w-3" />
        {title ?? c.label}
      </p>
      <div className="text-[0.95em] leading-[1.7] text-foreground/90">
        {children}
      </div>
    </aside>
  );
}
