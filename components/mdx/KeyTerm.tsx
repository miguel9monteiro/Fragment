import * as React from "react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getGlossaryTerm } from "@/lib/content";

export async function KeyTerm({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const term = await getGlossaryTerm(slug);
  const href = `/glossary#${slug.toLowerCase().replace(/\s+/g, "-")}`;

  if (!term) {
    return (
      <Link
        href={href}
        className="font-medium underline decoration-dotted decoration-gold/60 underline-offset-[3px]"
      >
        {children}
      </Link>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            className="font-medium underline decoration-dotted decoration-gold/70 underline-offset-[3px] hover:decoration-gold"
          >
            {children}
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium text-foreground">
            {term.term}
            {term.fullName && (
              <span className="text-muted-foreground font-normal">
                {" "}
                · {term.fullName}
              </span>
            )}
          </p>
          <p className="mt-1 text-muted-foreground">{term.definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
