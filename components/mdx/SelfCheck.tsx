"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function SelfCheck({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="my-7 border border-border rounded-sm overflow-hidden"
    >
      <CollapsibleTrigger className="w-full flex items-start gap-3 p-5 text-left hover:bg-secondary/50 transition-colors group">
        <span className="eyebrow-gold mt-1 shrink-0">Self-check</span>
        <span className="flex-1 font-serif text-[1.05em] leading-snug text-foreground">
          {question}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 mt-1 text-muted-foreground shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
        <div className="border-t border-border bg-secondary/40 px-5 py-4 text-[0.95em] leading-[1.7] text-foreground/90 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function Answer({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
