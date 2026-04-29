import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, ArrowUpRight, Wallet } from "lucide-react";
import { getPortfolio } from "@/lib/content";
import { PortfolioChart } from "@/components/PortfolioChart";
import type { Holding, Portfolio } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "PMC's virtual portfolio — current holdings, allocation, sector exposure, performance vs benchmark, and risk metrics.",
};

export default async function PortfolioPage() {
  const p = await getPortfolio();
  if (!p) {
    return (
      <section className="container py-32 max-w-2xl">
        <p className="eyebrow-accent mb-4">Portfolio</p>
        <h1 className="text-4xl font-bold tracking-tight">
          No portfolio data loaded.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Drop a fresh JSON at <code>content/portfolio/portfolio.json</code>.
        </p>
      </section>
    );
  }

  return (
    <>
      <Hero p={p} />
      <KPIBand p={p} />
      <ChartSection p={p} />
      <RiskMetrics p={p} />
      <AllocationSection p={p} />
      <SectorSection p={p} />
      <HoldingsSection p={p} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hero — title, AUM, as-of date                                             */
/* -------------------------------------------------------------------------- */

function Hero({ p }: { p: Portfolio }) {
  return (
    <section className="container pt-12 pb-10 border-b border-border">
      <p className="eyebrow-accent mb-3">Portfolio</p>
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
        Virtual portfolio
      </h1>
      <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
        Multi-asset, value-oriented, USD-denominated. Inception {formatDate(p.inceptionDate)},
        benchmarked 60% SPY / 40% IEI. The platform's view of the
        portfolio updates each time a new report is dropped in.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 tnum">
          <Calendar className="h-3 w-3" />
          As of {formatDate(p.asOfDate)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Wallet className="h-3 w-3" />
          {p.holdings.length} holdings
        </span>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  KPI band — AUM and the headline returns                                   */
/* -------------------------------------------------------------------------- */

function KPIBand({ p }: { p: Portfolio }) {
  const port = p.performance.portfolio;
  const bench = p.performance.benchmark;

  return (
    <section className="container py-10 border-b border-border">
      <div className="grid gap-px bg-border border border-border sm:grid-cols-2 lg:grid-cols-5">
        <KPI
          label="Total AUM"
          value={fmtUsd(p.totals.aum)}
          caption={`${fmtUsd(p.totals.cash)} cash on the side`}
          accent="primary"
        />
        <KPI
          label="YTD return"
          value={fmtPct(port.ytd)}
          caption={`Benchmark ${fmtPct(bench.ytd)}`}
          deltaVs={diff(port.ytd, bench.ytd)}
        />
        <KPI
          label="1-year return"
          value={fmtPct(port.yearly)}
          caption={`Benchmark ${fmtPct(bench.yearly)}`}
          deltaVs={diff(port.yearly, bench.yearly)}
        />
        <KPI
          label="Since inception"
          value={fmtPct(port.cumulative)}
          caption={`Benchmark ${fmtPct(bench.cumulative)}`}
          deltaVs={diff(port.cumulative, bench.cumulative)}
        />
        <KPI
          label="Sharpe (SI)"
          value={fmtNum(port.sharpeSi, 2)}
          caption={`Benchmark ${fmtNum(bench.sharpeSi, 2)}`}
        />
      </div>
    </section>
  );
}

function KPI({
  label,
  value,
  caption,
  deltaVs,
  accent,
}: {
  label: string;
  value: string;
  caption?: string;
  deltaVs?: number | null;
  accent?: "primary";
}) {
  return (
    <div className="bg-card p-6 flex flex-col gap-1.5">
      <p className="eyebrow text-muted-foreground/70">{label}</p>
      <p
        className={cn(
          "text-3xl font-bold tracking-tight tnum leading-none",
          accent === "primary" ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
      {(caption || deltaVs != null) && (
        <p className="text-xs text-muted-foreground leading-relaxed mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {caption && <span>{caption}</span>}
          {deltaVs != null && (
            <span
              className={cn(
                "tnum font-medium",
                deltaVs >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {deltaVs >= 0 ? "+" : ""}
              {(deltaVs * 100).toFixed(2)}pp
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chart                                                                     */
/* -------------------------------------------------------------------------- */

function ChartSection({ p }: { p: Portfolio }) {
  return (
    <section className="container py-12 border-b border-border">
      <PortfolioChart series={p.performanceSeries} />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Risk metrics — table with 1Y / SI columns, portfolio + benchmark           */
/* -------------------------------------------------------------------------- */

function RiskMetrics({ p }: { p: Portfolio }) {
  const port = p.performance.portfolio;
  const bench = p.performance.benchmark;

  const rows: {
    label: string;
    p1y: string;
    pSi: string;
    b1y: string;
    bSi: string;
  }[] = [
    {
      label: "Volatility",
      p1y: fmtPct(port.vol1y),
      pSi: fmtPct(port.volSi),
      b1y: fmtPct(bench.vol1y),
      bSi: fmtPct(bench.volSi),
    },
    {
      label: "Sharpe ratio",
      p1y: fmtNum(port.sharpe1y, 2),
      pSi: fmtNum(port.sharpeSi, 2),
      b1y: fmtNum(bench.sharpe1y, 2),
      bSi: fmtNum(bench.sharpeSi, 2),
    },
    {
      label: "Max drawdown",
      p1y: fmtPct(port.maxDd1y),
      pSi: fmtPct(port.maxDdSi),
      b1y: fmtPct(bench.maxDd1y),
      bSi: fmtPct(bench.maxDdSi),
    },
    {
      label: "VaR (1d, 95%)",
      p1y: fmtPct(port.var1y),
      pSi: fmtPct(port.varSi),
      b1y: fmtPct(bench.var1y),
      bSi: fmtPct(bench.varSi),
    },
    {
      label: "Win-day %",
      p1y: fmtPct(port.winDays1y),
      pSi: fmtPct(port.winDaysSi),
      b1y: fmtPct(bench.winDays1y),
      bSi: fmtPct(bench.winDaysSi),
    },
    {
      label: "Skew (1Y)",
      p1y: fmtNum(port.skew1y, 2),
      pSi: "—",
      b1y: fmtNum(bench.skew1y, 2),
      bSi: "—",
    },
    {
      label: "Kurtosis (1Y)",
      p1y: fmtNum(port.kurtosis1y, 2),
      pSi: "—",
      b1y: fmtNum(bench.kurtosis1y, 2),
      bSi: "—",
    },
  ];

  return (
    <section className="container py-12 border-b border-border">
      <div className="mb-6">
        <p className="eyebrow-accent mb-2">Risk</p>
        <h2 className="text-2xl font-bold tracking-tight">Risk metrics</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Portfolio versus benchmark across the trailing 1-year window and
          since inception.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                Metric
              </th>
              <th
                className="text-right px-4 py-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold"
                colSpan={2}
              >
                Portfolio
              </th>
              <th
                className="text-right px-4 py-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold"
                colSpan={2}
              >
                Benchmark
              </th>
            </tr>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground/70 border-b border-border">
              <th className="px-4 pb-2"></th>
              <th className="text-right px-4 pb-2 font-medium">1Y</th>
              <th className="text-right px-4 pb-2 font-medium">Since inception</th>
              <th className="text-right px-4 pb-2 font-medium">1Y</th>
              <th className="text-right px-4 pb-2 font-medium">Since inception</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {rows.map((r) => (
              <tr
                key={r.label}
                className="border-b border-border/70 last:border-0"
              >
                <td className="px-4 py-3 font-medium text-primary">
                  {r.label}
                </td>
                <td className="text-right px-4 py-3">{r.p1y}</td>
                <td className="text-right px-4 py-3">{r.pSi}</td>
                <td className="text-right px-4 py-3 text-muted-foreground">{r.b1y}</td>
                <td className="text-right px-4 py-3 text-muted-foreground">{r.bSi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Asset-class allocation — horizontal stacked bar                            */
/* -------------------------------------------------------------------------- */

const ASSET_COLORS: Record<string, string> = {
  Equity: "bg-primary",
  "Equity ETF": "bg-steel",
  Bond: "bg-foreground/35",
  "Bond ETF": "bg-foreground/22",
  FX: "bg-warning",
  Commodity: "bg-success",
  Cash: "bg-foreground/12",
};

function colorFor(assetType: string): string {
  return ASSET_COLORS[assetType] ?? "bg-muted-foreground";
}

function AllocationSection({ p }: { p: Portfolio }) {
  // Sort by current weight desc, drop zero-weight rows
  const rows = [...p.byAssetType]
    .filter((r) => r.currentValue > 0)
    .sort((a, b) => b.weight - a.weight);

  return (
    <section className="container py-12 border-b border-border">
      <div className="mb-6">
        <p className="eyebrow-accent mb-2">Allocation</p>
        <h2 className="text-2xl font-bold tracking-tight">By asset class</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Current exposure by asset class. The two ETF positions (MSCI World
          Small Cap, IEI) provide most of the broad-market beta; the
          single-name equity book adds the active alpha tilt.
        </p>
      </div>

      <div className="flex w-full overflow-hidden rounded-sm border border-border h-3 mb-5">
        {rows.map((r) => (
          <div
            key={r.assetType}
            className={cn("h-full", colorFor(r.assetType))}
            style={{ flex: r.weight }}
            aria-label={`${r.assetType}: ${(r.weight * 100).toFixed(1)}%`}
          />
        ))}
      </div>

      <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        {rows.map((r) => (
          <li key={r.assetType} className="flex items-center gap-3">
            <span
              className={cn("h-3 w-3 rounded-sm shrink-0", colorFor(r.assetType))}
            />
            <span className="flex-1 font-medium">{r.assetType}</span>
            <span className="tnum text-muted-foreground text-xs">
              {r.count} · {(r.weight * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sector exposure (equities only)                                           */
/* -------------------------------------------------------------------------- */

function SectorSection({ p }: { p: Portfolio }) {
  const rows = [...p.bySector]
    .filter((r) => r.currentValue > 0)
    .sort((a, b) => b.weight - a.weight);

  if (rows.length === 0) return null;

  // Bar maxes are scaled to the LARGEST equity-sector weight, not portfolio
  // total, so visual comparisons within the section are meaningful.
  const max = Math.max(...rows.map((r) => r.weight));

  return (
    <section className="container py-12 border-b border-border">
      <div className="mb-6">
        <p className="eyebrow-accent mb-2">Sector exposure</p>
        <h2 className="text-2xl font-bold tracking-tight">
          By sector (equities only)
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Direct single-name equity exposure by sector — excludes ETF
          allocations, which are diversified across sectors by construction.
        </p>
      </div>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.sector}
            className="grid gap-x-4 sm:grid-cols-[12rem_1fr_auto] items-center"
          >
            <span className="font-medium text-primary text-sm">
              {r.sector}
            </span>
            <span className="block h-2.5 bg-secondary rounded-sm overflow-hidden">
              <span
                className="block h-full bg-steel"
                style={{ width: `${(r.weight / max) * 100}%` }}
              />
            </span>
            <span className="tnum text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {r.count} · {(r.weight * 100).toFixed(2)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Holdings table                                                            */
/* -------------------------------------------------------------------------- */

function HoldingsSection({ p }: { p: Portfolio }) {
  const sorted = [...p.holdings].sort((a, b) => b.weight - a.weight);

  return (
    <section className="container py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow-accent mb-2">Holdings</p>
          <h2 className="text-2xl font-bold tracking-tight">
            Every position
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            All {sorted.length} positions, sorted by current weight. Positions
            with a corresponding pitch or vote on this platform have a small
            link in the row.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded-sm">
        <table className="w-full text-sm">
          <thead className="bg-secondary border-b border-primary/40">
            <tr>
              <Th className="text-left">Position</Th>
              <Th className="text-left">Type</Th>
              <Th className="text-left">Sector</Th>
              <Th className="text-right">Weight</Th>
              <Th className="text-right">Current value</Th>
              <Th className="text-right">P&amp;L since purchase</Th>
              <Th className="text-right">Purchased</Th>
            </tr>
          </thead>
          <tbody className="tnum">
            {sorted.map((h) => (
              <HoldingRow key={h.ticker} h={h} />
            ))}
          </tbody>
          <tfoot className="bg-secondary/50 border-t-2 border-primary">
            <tr>
              <td colSpan={3} className="px-4 py-3 font-semibold text-primary">
                Portfolio total
              </td>
              <td className="px-4 py-3 text-right font-semibold tnum">
                {(sorted.reduce((s, h) => s + h.weight, 0) * 100).toFixed(2)}%
              </td>
              <td className="px-4 py-3 text-right font-semibold tnum">
                {fmtUsd(p.totals.portfolio)}
              </td>
              <td className="px-4 py-3 text-right font-semibold tnum">
                {fmtPnLOverall(sorted)}
              </td>
              <td className="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function HoldingRow({ h }: { h: Holding }) {
  const pnl = h.currentValue - h.invested;
  const pnlPct = h.invested > 0 ? pnl / h.invested : 0;
  const pnlPositive = pnl >= 0;

  return (
    <tr className="border-b border-border/70 last:border-0 hover:bg-secondary/40 transition-colors">
      <td className="px-4 py-3.5">
        <div className="font-semibold text-primary leading-tight">
          {h.name}
        </div>
        <div className="text-[11px] text-muted-foreground tnum mt-0.5 flex items-center gap-2">
          <span>{h.ticker}</span>
          {h.currency !== "USD" && (
            <>
              <span aria-hidden>·</span>
              <span>{h.currency}</span>
            </>
          )}
          {(h.pitchSlug || h.pollSlug) && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-2">
                {h.pitchSlug && (
                  <Link
                    href={`/pitches/${h.pitchSlug}`}
                    className="inline-flex items-center gap-0.5 text-steel hover:underline"
                  >
                    Pitch <ArrowUpRight className="h-2.5 w-2.5" />
                  </Link>
                )}
                {h.pollSlug && (
                  <Link
                    href={`/votings`}
                    className="inline-flex items-center gap-0.5 text-steel hover:underline"
                  >
                    Vote <ArrowUpRight className="h-2.5 w-2.5" />
                  </Link>
                )}
              </span>
            </>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn("h-2 w-2 rounded-sm", colorFor(h.assetType))}
            aria-hidden
          />
          <span className="text-xs">{h.assetType}</span>
        </span>
      </td>
      <td className="px-4 py-3.5 text-xs text-muted-foreground">
        {h.sector === "Not Applicable" || !h.sector ? "—" : h.sector}
      </td>
      <td className="px-4 py-3.5 text-right font-semibold">
        {(h.weight * 100).toFixed(2)}%
      </td>
      <td className="px-4 py-3.5 text-right">
        {fmtUsd(h.currentValue)}
      </td>
      <td className="px-4 py-3.5 text-right">
        <span
          className={cn(
            "tnum",
            pnlPositive ? "text-success" : "text-destructive",
          )}
        >
          {pnlPositive ? "+" : ""}
          {(pnlPct * 100).toFixed(2)}%
          <span className="ml-2 text-[11px] opacity-80">
            ({pnlPositive ? "+" : ""}
            {fmtUsd(pnl)})
          </span>
        </span>
      </td>
      <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
        {h.purchaseDate ? formatDate(h.purchaseDate) : "—"}
      </td>
    </tr>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-[11px] uppercase tracking-[0.12em] font-semibold text-primary",
        className,
      )}
    >
      {children}
    </th>
  );
}

/* -------------------------------------------------------------------------- */
/*  Formatting helpers                                                        */
/* -------------------------------------------------------------------------- */

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(v: number | string | null | undefined): string {
  if (v == null || v === "-") return "—";
  if (typeof v === "string") return v;
  return `${(v * 100).toFixed(2)}%`;
}

function fmtNum(v: number | string | null | undefined, decimals = 2): string {
  if (v == null || v === "-") return "—";
  if (typeof v === "string") return v;
  return v.toFixed(decimals);
}

function diff(a: number | string | null, b: number | string | null): number | null {
  if (typeof a !== "number" || typeof b !== "number") return null;
  return a - b;
}

function fmtPnLOverall(holdings: Holding[]): string {
  const totalInv = holdings.reduce((s, h) => s + h.invested, 0);
  const totalNow = holdings.reduce((s, h) => s + h.currentValue, 0);
  const pnl = totalNow - totalInv;
  const pct = totalInv > 0 ? pnl / totalInv : 0;
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${(pct * 100).toFixed(2)}% (${sign}${fmtUsd(pnl)})`;
}
