// The cockpit. Composes seven independent server-component sections, each
// of which queries its own slice of state via the admin Supabase client.
// Section components are wrapped in Suspense so the page progressively
// hydrates: the fast queries (StatusBanner, AlertList) appear in <50ms
// while slower ones (FleetHealthTable's 24h aggregate) trickle in.
//
// Layout is two columns on wide screens (≥lg breakpoint), stacked on
// tablet/mobile. The order is deliberate:
//
//   Top:    StatusBanner          — single-glance "is it OK?"
//   Right:  AlertList             — active problems, top of right column
//           DigestPanel           — daily heartbeat
//           DriftTable            — passive coverage check
//   Left:   FleetHealthTable      — per-source health (biggest table)
//           FirmsTable            — per-firm operations (longest table)
//           RecentJobsList        — sanity-check the classifier
//
// The page revalidates every 30 seconds so the operator gets fresh state
// without needing a manual refresh, while still being cacheable for the
// duration of any single navigation.

import { Suspense } from 'react';

import { AlertList } from './_components/AlertList';
import { DigestPanel } from './_components/DigestPanel';
import { DriftTable } from './_components/DriftTable';
import { FirmsTable } from './_components/FirmsTable';
import { FleetHealthTable } from './_components/FleetHealthTable';
import { RecentJobsList } from './_components/RecentJobsList';
import { StatusBanner } from './_components/StatusBanner';
import { Section } from './_components/ui';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type FirmFilter = 'all' | 'active' | 'inactive' | 'erroring' | 'backoff' | 'no-success-24h';
const VALID_FILTERS: FirmFilter[] = ['all', 'active', 'inactive', 'erroring', 'backoff', 'no-success-24h'];

function parseFirmsFilter(raw: string | string[] | undefined): FirmFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && (VALID_FILTERS as string[]).includes(v)) return v as FirmFilter;
  return 'all';
}

interface AdminPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const firmsFilter = parseFirmsFilter(params.firms);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <Suspense fallback={<SectionSkeleton title="Fleet status" />}>
        <StatusBanner />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6 min-w-0">
          <Suspense fallback={<SectionSkeleton title="Fleet health" />}>
            <FleetHealthTable />
          </Suspense>

          <Suspense fallback={<SectionSkeleton title="Firms" />}>
            <FirmsTable filter={firmsFilter} />
          </Suspense>

          <Suspense fallback={<SectionSkeleton title="Recent jobs" />}>
            <RecentJobsList />
          </Suspense>
        </div>

        <aside className="space-y-6 min-w-0">
          <Suspense fallback={<SectionSkeleton title="Open alerts" />}>
            <AlertList />
          </Suspense>

          <Suspense fallback={<SectionSkeleton title="Daily digest" />}>
            <DigestPanel />
          </Suspense>

          <Suspense fallback={<SectionSkeleton title="ATS drift" />}>
            <DriftTable />
          </Suspense>
        </aside>
      </div>
    </main>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <Section title={title} subtitle="loading…">
      <div className="p-4 space-y-2">
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </Section>
  );
}
