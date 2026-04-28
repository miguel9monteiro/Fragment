"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function DeepDive({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="my-8 border border-dashed border-border rounded-sm"
    >
      <CollapsibleTrigger className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-secondary/50 transition-colors">
        <span className="eyebrow shrink-0">Deep dive</span>
        <span className="flex-1 text-base font-semibold tracking-tight">
          {title}
        </span>
        <Plus
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-45",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
        <div className="border-t border-dashed border-border px-5 py-5 text-[0.95em] leading-[1.7] text-foreground/90 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
