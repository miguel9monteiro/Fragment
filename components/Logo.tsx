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
      <span
        className="flex h-9 w-9 items-center justify-center rounded-sm bg-primary overflow-hidden"
        aria-hidden
      >
        <Image
          src="/logos/pmc.webp"
          alt=""
          width={36}
          height={36}
          className="h-full w-full object-contain p-1"
          priority
        />
      </span>
      {showFull && (
        <span className="flex flex-col leading-none">
          <span className="font-serif text-[15px] font-semibold tracking-tight">
            Portfolio Management Club
          </span>
          <span className="eyebrow mt-1">Nova SBE · Knowledge</span>
        </span>
      )}
    </Link>
  );
}
