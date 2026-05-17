// Open alerts list. Every row carries Ack (silence — keeps the alert open
// but marks operator-aware) and Resolve (manually close even if the
// detector would re-raise on the next watchdog tick — useful when the
// operator knows a fix is in flight).
//
// Sorted by level severity DESC then raised_at DESC so critical incidents
// stay at the top regardless of cluster.

import { acknowledgeAlert, resolveAlert } from '../_actions';
import { EmptyState, Pill, Section, timeAgo } from './ui';

import { getSupabaseAdminClient } from '@/tracker/lib/supabase/admin';

interface OpenAlert {
  id: number;
  level: string;
  kind: string;
  firm_id: string | null;
  message: string;
  detail: unknown;
  raised_at: string;
  acknowledged_at: string | null;
  firm: { slug: string } | { slug: string }[] | null;
}

const LEVEL_RANK: Record<string, number> = { critical: 0, error: 1, warn: 2, info: 3 };

function firmSlugOf(rel: OpenAlert['firm']): string | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0]?.slug ?? null) : rel.slug;
}

export async function AlertList() {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from('system_alerts')
    .select('id,level,kind,firm_id,message,detail,raised_at,acknowledged_at,firm:firms(slug)')
    .is('resolved_at', null)
    .order('raised_at', { ascending: false })
    .limit(200);

  const alerts = (data ?? []) as unknown as OpenAlert[];
  alerts.sort((a, b) => {
    const r = (LEVEL_RANK[a.level] ?? 99) - (LEVEL_RANK[b.level] ?? 99);
    return r !== 0 ? r : b.raised_at.localeCompare(a.raised_at);
  });

  return (
    <Section
      title="Open alerts"
      subtitle={`${alerts.length} active`}
    >
      {alerts.length === 0 ? (
        <EmptyState>No open alerts. Fleet is nominal.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Pill tone={a.level as 'info' | 'warn' | 'error' | 'critical'}>{a.level}</Pill>
                  <span className="font-mono text-muted-foreground">{a.kind}</span>
                  {firmSlugOf(a.firm) ? (
                    <span className="font-mono text-muted-foreground">· {firmSlugOf(a.firm)}</span>
                  ) : null}
                  <span className="text-muted-foreground">· {timeAgo(a.raised_at)}</span>
                  {a.acknowledged_at ? (
                    <Pill tone="muted">acked</Pill>
                  ) : null}
                </div>
                <p className="text-sm break-words">{a.message}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {!a.acknowledged_at ? (
                  <form action={acknowledgeAlert}>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      Ack
                    </button>
                  </form>
                ) : null}
                <form action={resolveAlert}>
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Resolve
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
