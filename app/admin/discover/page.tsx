// Tier-6 ATS auto-discovery cockpit. Paste a careers URL, get a structured
// suggestion the operator can review and one-click insert as a new firm.
//
// Flow:
//   1. Operator submits the form with careers_url + (optional) name/slug.
//   2. discoverAts() server action calls poll-ats-discover Edge Function.
//   3. The result lists every plausible ATS candidate, ranked by confidence,
//      with extracted config + (where possible) a real sample job.
//   4. Each candidate row has an "Insert as firm" form that POSTs to
//      insertFirmFromDiscovery — creates the row with active=false so the
//      operator can verify before activating.
//
// The page is /admin/discover so it inherits the layout's auth + email
// gate. No additional gating needed.

import Link from 'next/link';

import { discoverAts, insertFirmFromDiscovery } from '../_actions';
import { EmptyState, Pill, Section } from '../_components/ui';

interface DiscoverPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getParam(raw: string | string[] | undefined): string {
  return typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : '';
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const params = await searchParams;
  const careersUrl = getParam(params.url).trim();
  const nameHint = getParam(params.name).trim();
  const slugHint = getParam(params.slug).trim();

  const result = careersUrl ? await discoverAts(careersUrl) : null;
  const inferredName = nameHint || (careersUrl ? new URL(careersUrl).hostname.replace(/^www\./, '').split('.')[0] : '');
  const inferredSlug = slugHint || slugify(inferredName);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Add a firm</h1>
        <p className="text-sm text-muted-foreground">
          Paste a careers URL. The discoverer probes the page for ATS vendor
          signals, extracts tenant config, and (for the easy ATSes) samples
          one live job so you can confirm before saving.
        </p>
        <p className="text-xs text-muted-foreground">
          <Link href="/admin" className="hover:text-foreground">← back to cockpit</Link>
        </p>
      </div>

      <form method="get" className="space-y-3 rounded-lg border border-border bg-card p-4">
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Careers URL
          </span>
          <input
            type="url"
            name="url"
            required
            placeholder="https://www.example.com/careers"
            defaultValue={careersUrl}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Firm name (optional)
            </span>
            <input
              type="text"
              name="name"
              placeholder="Example Bank"
              defaultValue={nameHint}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Slug (optional)
            </span>
            <input
              type="text"
              name="slug"
              placeholder="example-bank"
              defaultValue={slugHint}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono shadow-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10"
            />
          </label>
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Discover
        </button>
      </form>

      {result ? (
        <ResultsPanel
          result={result}
          inferredName={inferredName}
          inferredSlug={inferredSlug}
        />
      ) : null}
    </main>
  );
}

function ResultsPanel({
  result,
  inferredName,
  inferredSlug,
}: {
  result: Awaited<ReturnType<typeof discoverAts>>;
  inferredName: string;
  inferredSlug: string;
}) {
  if (!result.ok) {
    return (
      <Section title="Discovery failed">
        <div className="p-4 text-sm text-red-700 dark:text-red-400">
          <p>{result.error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Final URL: <span className="font-mono">{result.careers_url}</span>
            {result.status_code ? ` · HTTP ${result.status_code}` : ''}
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section
      title={`Discovered: ${result.candidates.length} ATS candidate${result.candidates.length === 1 ? '' : 's'}`}
      subtitle={
        result.vendor_signals.length > 0
          ? `Signals on page: ${result.vendor_signals.join(', ')} · final URL ${result.careers_url}`
          : `No ATS signals detected on ${result.careers_url}`
      }
    >
      {result.candidates.length === 0 ? (
        <EmptyState>
          No ATS vendor signals matched. The firm may be on an unsupported ATS
          (iCIMS, Taleo TGnewUI, SuccessFactors, Talentsoft, Inrecruiting,
          Recruitee, Trakstar) or behind a JS-rendered SPA that hides the
          underlying host. Open the page&apos;s Network tab to find the actual
          XHR endpoint.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {result.candidates.map((c, idx) => (
            <CandidateRow
              key={idx}
              candidate={c}
              inferredName={inferredName}
              inferredSlug={inferredSlug}
              careersUrl={result.careers_url}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function CandidateRow({
  candidate,
  inferredName,
  inferredSlug,
  careersUrl,
}: {
  candidate: Awaited<ReturnType<typeof discoverAts>>['candidates'][number];
  inferredName: string;
  inferredSlug: string;
  careersUrl: string;
}) {
  const tone =
    candidate.confidence === 'high' ? 'ok' : candidate.confidence === 'medium' ? 'warn' : 'muted';

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={tone}>{candidate.confidence}</Pill>
          <span className="font-mono text-sm font-medium">{candidate.ats}</span>
        </div>
      </div>

      <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed">
{JSON.stringify(candidate.ats_config, null, 2)}
      </pre>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">
          Evidence ({candidate.evidence.length})
        </summary>
        <ul className="mt-1.5 space-y-1 pl-4">
          {candidate.evidence.map((e, i) => (
            <li key={i} className="break-words">• {e}</li>
          ))}
        </ul>
      </details>

      {candidate.sample ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-900 dark:text-emerald-200">Live sample job confirms the config works:</p>
          <p className="mt-1 break-words text-emerald-900 dark:text-emerald-200">{candidate.sample.title}</p>
          {candidate.sample.location ? (
            <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-300/80">{candidate.sample.location}</p>
          ) : null}
          <a
            href={candidate.sample.apply_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-emerald-900 underline hover:no-underline dark:text-emerald-200"
          >
            open ↗
          </a>
        </div>
      ) : null}

      <form action={insertFirmFromDiscovery} className="space-y-2 rounded-md border border-border p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="block text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Name</span>
            <input
              type="text"
              name="name"
              required
              defaultValue={inferredName}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Slug</span>
            <input
              type="text"
              name="slug"
              required
              defaultValue={inferredSlug}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs"
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-[10px] font-medium tracking-wider text-muted-foreground uppercase">ATS</span>
            <input
              type="text"
              name="ats"
              required
              readOnly
              defaultValue={candidate.ats}
              className="w-full rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-xs"
            />
          </label>
        </div>
        <input type="hidden" name="careers_url" value={careersUrl} />
        <input type="hidden" name="ats_config" value={JSON.stringify(candidate.ats_config)} />
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Insert as firm (inactive)
        </button>
        <p className="text-[10px] text-muted-foreground">
          The new row will be created with active=false. Verify in the cockpit and toggle Active to start polling.
        </p>
      </form>
    </li>
  );
}
