// Configured-vs-detected ATS mismatch surface. The careers-scan extracts
// ATS-vendor signals from each firm's marketing careers page. We compare
// against firms.ats: any firm where the configured ATS is *not* present in
// the detected signals is a candidate for re-verification.
//
// Why this isn't a watchdog alert: it's noisy by design. Many firms have
// marketing pages that link to a sibling brand's ATS (Bank of America's
// page references avature + oleeo + workday across three business lines).
// A hard alert per mismatch would spam the operator; a passive panel that
// surfaces the candidate list during routine cockpit review is the right
// shape.

import { EmptyState, Pill, Section } from './ui';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

interface DriftCandidate {
  firm_id: string;
  firm_slug: string;
  configured_ats: string;
  detected_signals: string[];
  snapshot_at: string;
  url: string;
}

async function loadDrift(): Promise<DriftCandidate[]> {
  const admin = getSupabaseAdminClient();
  // Latest snapshot per firm. We don't have a window function via PostgREST
  // so we pull all snapshots ordered by firm + time, then dedupe client-side
  // to the most recent per firm. firm_careers_snapshots is small (~50 rows
  // per week × N weeks), so this stays cheap.
  const { data: snapshots } = await admin
    .from('firm_careers_snapshots')
    .select('firm_id,firm_slug,ats_signals,snapshot_at,url')
    .order('snapshot_at', { ascending: false })
    .limit(500);

  const latestByFirm = new Map<string, { firm_id: string; firm_slug: string; ats_signals: string[]; snapshot_at: string; url: string }>();
  for (const s of (snapshots ?? []) as { firm_id: string; firm_slug: string; ats_signals: string[]; snapshot_at: string; url: string }[]) {
    if (!s.firm_id) continue;
    if (latestByFirm.has(s.firm_id)) continue;
    latestByFirm.set(s.firm_id, s);
  }

  if (latestByFirm.size === 0) return [];

  const { data: firms } = await admin
    .from('firms')
    .select('id,slug,ats')
    .in('id', Array.from(latestByFirm.keys()));

  const out: DriftCandidate[] = [];
  for (const f of (firms ?? []) as { id: string; slug: string; ats: string }[]) {
    const snap = latestByFirm.get(f.id);
    if (!snap) continue;
    const detected = snap.ats_signals ?? [];
    if (detected.length === 0) continue; // no signals captured at all — can't compare
    if (detected.includes(f.ats)) continue; // configured ats is in the detected set — match
    out.push({
      firm_id: f.id,
      firm_slug: f.slug,
      configured_ats: f.ats,
      detected_signals: detected,
      snapshot_at: snap.snapshot_at,
      url: snap.url,
    });
  }
  out.sort((a, b) => a.firm_slug.localeCompare(b.firm_slug));
  return out;
}

export async function DriftTable() {
  const rows = await loadDrift();
  return (
    <Section
      title="ATS drift candidates"
      subtitle="firms whose configured ATS is missing from their detected careers-page signals"
    >
      {rows.length === 0 ? (
        <EmptyState>No drift candidates. Every configured ATS appears on its firm&apos;s careers page.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs tracking-wider text-muted-foreground uppercase">
                <th className="px-4 py-2 font-medium">Firm</th>
                <th className="px-3 py-2 font-medium">Configured</th>
                <th className="px-3 py-2 font-medium">Detected on page</th>
                <th className="px-3 py-2 font-medium">URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.firm_id}>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs">{r.firm_slug}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone="muted">{r.configured_ats}</Pill>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.detected_signals.map((s) => (
                        <Pill key={s} tone="info">{s}</Pill>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      open ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
