import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  showFull = true,
}: {
  className?: string;
  showFull?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex items-center gap-3 outline-none",
        className,
      )}
      aria-label="Portfolio Management Club — home"
    >
      <Image
        src="/logos/pmc.webp"
        alt="PMC"
        width={300}
        height={100}
        className="h-7 w-auto dark:invert"
        priority
      />
      {showFull && (
        <span className="hidden md:flex flex-col leading-none border-l border-border pl-3 ml-1">
          <span className="text-[13px] font-semibold tracking-tight">
            Portfolio Management Club
          </span>
          <span className="eyebrow mt-1">Nova SBE · Knowledge</span>
        </span>
      )}
    </Link>
  );
}
