"use client";

import { useMemo, useState } from "react";
import type { PerformancePoint } from "@/lib/types";
import { cn } from "@/lib/utils";

type Range = "1m" | "6m" | "ytd" | "1y" | "si";

const RANGE_LABELS: Record<Range, string> = {
  "1m": "1M",
  "6m": "6M",
  ytd: "YTD",
  "1y": "1Y",
  si: "Since inception",
};

const RANGE_ORDER: Range[] = ["1m", "6m", "ytd", "1y", "si"];

function rangeStart(asOf: Date, range: Range): Date {
  const d = new Date(asOf);
  switch (range) {
    case "1m": d.setMonth(d.getMonth() - 1); return d;
    case "6m": d.setMonth(d.getMonth() - 6); return d;
    case "ytd": return new Date(asOf.getFullYear(), 0, 1);
    case "1y": d.setFullYear(d.getFullYear() - 1); return d;
    case "si": return new Date(0);
  }
}

export function PortfolioChart({ series }: { series: PerformancePoint[] }) {
  const [range, setRange] = useState<Range>("si");

  const filtered = useMemo(() => {
    if (series.length === 0) return [];
    const last = new Date(series[series.length - 1].date + "T00:00:00");
    const cutoff = rangeStart(last, range);
    if (range === "si") return series;

    // Re-base the series so the cumulative curves both start at 0% on the
    // first visible day. Otherwise short ranges show absolute SI cumulative
    // which dwarfs short-term moves.
    const sliced = series.filter((p) => new Date(p.date) >= cutoff);
    if (sliced.length === 0) return [];
    const baseP = sliced[0].portfolioCum;
    const baseB = sliced[0].benchmarkCum;
    return sliced.map((p) => ({
      ...p,
      portfolioCum: (1 + p.portfolioCum) / (1 + baseP) - 1,
      benchmarkCum: (1 + p.benchmarkCum) / (1 + baseB) - 1,
    }));
  }, [series, range]);

  return (
    <div className="not-prose">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="eyebrow-accent mb-2">Performance</p>
          <h2 className="text-2xl font-bold tracking-tight">
            Cumulative return
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Portfolio vs benchmark (60% SPY / 40% IEI), rebased to 0% at the
            start of the selected window.
          </p>
        </div>
        <div className="flex items-center border border-border rounded-sm">
          {RANGE_ORDER.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={cn(
                "h-8 px-3 text-[12px] font-medium border-l border-border first:border-l-0 transition-colors tnum",
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground/80 hover:bg-secondary",
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <ChartSvg points={filtered} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chart SVG — no dependencies, deliberately spare                            */
/* -------------------------------------------------------------------------- */

const PADDING = { top: 16, right: 24, bottom: 32, left: 56 };
const ASPECT = 0.32; // height / width

function ChartSvg({ points }: { points: PerformancePoint[] }) {
  if (points.length < 2) {
    return (
      <div className="h-72 border border-border bg-card grid place-items-center text-sm text-muted-foreground">
        Not enough data in this window.
      </div>
    );
  }

  const W = 1200;
  const H = Math.round(W * ASPECT);
  const innerW = W - PADDING.left - PADDING.right;
  const innerH = H - PADDING.top - PADDING.bottom;

  const allValues: number[] = [];
  for (const p of points) {
    allValues.push(p.portfolioCum, p.benchmarkCum);
  }
  let minY = Math.min(...allValues);
  let maxY = Math.max(...allValues);
  // Pad y-axis 5% on each side so lines breathe.
  const padY = (maxY - minY) * 0.08 || 0.01;
  minY -= padY;
  maxY += padY;

  const x = (i: number) => PADDING.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) =>
    PADDING.top + (1 - (v - minY) / (maxY - minY)) * innerH;

  const portfolioPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.portfolioCum).toFixed(2)}`)
    .join(" ");
  const benchPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(p.benchmarkCum).toFixed(2)}`)
    .join(" ");

  // Y-axis ticks — 5 evenly spaced
  const yTicks: { value: number; y: number }[] = [];
  for (let i = 0; i <= 4; i++) {
    const v = minY + (i / 4) * (maxY - minY);
    yTicks.push({ value: v, y: y(v) });
  }

  // X-axis ticks — first, ~25%, ~50%, ~75%, last
  const xTickIdxs = [
    0,
    Math.round((points.length - 1) * 0.25),
    Math.round((points.length - 1) * 0.5),
    Math.round((points.length - 1) * 0.75),
    points.length - 1,
  ];

  const last = points[points.length - 1];

  return (
    <div className="border border-border bg-card overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        role="img"
        aria-label="Cumulative return chart, portfolio versus benchmark"
      >
        {/* Y-axis gridlines and labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PADDING.left}
              x2={W - PADDING.right}
              y1={t.y}
              y2={t.y}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              strokeDasharray={i === 0 || i === yTicks.length - 1 ? "0" : "2 4"}
            />
            <text
              x={PADDING.left - 8}
              y={t.y}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize="11"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {(t.value * 100).toFixed(t.value > 1 ? 0 : 1)}%
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xTickIdxs.map((idx, i) => (
          <text
            key={i}
            x={x(idx)}
            y={H - PADDING.bottom + 18}
            textAnchor={i === 0 ? "start" : i === xTickIdxs.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground"
            fontSize="11"
          >
            {formatTick(points[idx].date)}
          </text>
        ))}

        {/* Benchmark line — drawn first so portfolio sits on top */}
        <path
          d={benchPath}
          fill="none"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />

        {/* Portfolio line */}
        <path
          d={portfolioPath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End-point markers + labels */}
        <circle
          cx={x(points.length - 1)}
          cy={y(last.portfolioCum)}
          r={3.5}
          fill="hsl(var(--primary))"
        />
        <circle
          cx={x(points.length - 1)}
          cy={y(last.benchmarkCum)}
          r={3}
          fill="hsl(var(--muted-foreground))"
        />
      </svg>

      {/* Legend below chart */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 pb-5 pt-2 text-xs">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <li className="inline-flex items-center gap-2">
            <span className="inline-block w-5 h-0.5 bg-primary" />
            <span className="font-medium">Portfolio</span>
            <span className="tnum text-muted-foreground">
              {fmtPct(last.portfolioCum)}
            </span>
          </li>
          <li className="inline-flex items-center gap-2">
            <span
              className="inline-block w-5 border-t border-dashed border-muted-foreground"
              style={{ height: 0 }}
            />
            <span className="font-medium">Benchmark</span>
            <span className="tnum text-muted-foreground">
              {fmtPct(last.benchmarkCum)}
            </span>
          </li>
        </ul>
        <span className="tnum text-muted-foreground">
          Spread:{" "}
          <span className={cn(
            last.portfolioCum >= last.benchmarkCum
              ? "text-success"
              : "text-destructive",
          )}>
            {fmtPctSigned(last.portfolioCum - last.benchmarkCum)}
          </span>
        </span>
      </div>
    </div>
  );
}

function formatTick(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtPctSigned(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(2)}%`;
}
