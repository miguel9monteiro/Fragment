"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type SlideAnnotation = {
  /** Position in % of image dimensions */
  x: number;
  y: number;
  label: string;
  detail: string;
};

export function PitchSlide({
  src,
  alt,
  caption,
  width = 1600,
  height = 900,
  annotations = [],
  className,
}: {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  annotations?: SlideAnnotation[];
  className?: string;
}) {
  const [active, setActive] = React.useState<number | null>(null);

  return (
    <figure className={cn("my-8 not-prose", className)}>
      <div className="relative border border-border bg-secondary rounded-sm overflow-hidden shadow-sm">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="w-full h-auto"
          unoptimized={src.startsWith("http")}
        />
        {annotations.map((a, i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(active === i ? null : i)}
            aria-label={`Annotation ${i + 1}: ${a.label}`}
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full bg-steel text-steel-foreground text-[11px] font-semibold shadow-md ring-2 ring-background transition-transform",
                active === i ? "scale-110" : "group-hover:scale-110",
              )}
            >
              {i + 1}
            </span>
          </button>
        ))}

        {active !== null && (
          <div
            className="absolute z-10 left-4 right-4 bottom-4 sm:left-auto sm:right-4 sm:max-w-sm bg-background/97 backdrop-blur border border-border rounded-sm p-4 text-sm shadow-lg animate-fade-in"
            role="status"
          >
            <p className="eyebrow-accent mb-1.5">
              Note {active + 1} · {annotations[active].label}
            </p>
            <p className="text-foreground/90 leading-relaxed">
              {annotations[active].detail}
            </p>
          </div>
        )}
      </div>
      {(caption || annotations.length > 0) && (
        <figcaption className="mt-3 text-xs text-muted-foreground italic flex items-center gap-2">
          {annotations.length > 0 && (
            <span className="eyebrow text-muted-foreground/80">
              {annotations.length}{" "}
              {annotations.length === 1 ? "note" : "notes"} · hover or tap
            </span>
          )}
          {caption && <span>{caption}</span>}
        </figcaption>
      )}
    </figure>
  );
}
