// Server actions used by the /admin cockpit and the /login page. Every
// mutation goes through here so the gating, revalidation, and side-effect
// logging stays in one place.
//
// All actions assume one of:
//   - The caller has already passed the /admin layout's auth + email gate
//     (every action other than sendMagicLink + signOut), OR
//   - The action does not mutate authoritative state and only depends on
//     anon-side identity (sendMagicLink).
//
// We re-check auth + email inside the destructive actions as defense in
// depth — a server action endpoint is publicly callable, and Next does not
// magically inherit the layout gate. The redundant check costs one cookie
// read and prevents a serious privilege-escalation footgun.

'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const ADMIN_EMAILS = (process.env.ADMIN_EMAIL ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

async function requireAdmin(): Promise<{ email: string } | { error: string }> {
  if (ADMIN_EMAILS.length === 0) {
    return { error: 'ADMIN_EMAIL env var is not configured; no users are authorised for admin actions.' };
  }
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return { error: 'not_authenticated' };
  if (!ADMIN_EMAILS.includes(email)) return { error: `forbidden:${email}` };
  return { email };
}

// ---------------------------------------------------------------------------
// Auth: magic link + sign out
// ---------------------------------------------------------------------------

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) redirect('/login?error=missing-email');

  // Refuse to send magic links to addresses outside the allowlist. Without
  // this, anyone could spam-trigger Supabase Auth's email send for any
  // address. The check matches the layout gate so the user can't even
  // start the flow they're going to fail.
  if (ADMIN_EMAILS.length === 0 || !ADMIN_EMAILS.includes(email)) {
    // Don't leak whether the email is in the allowlist via the error message.
    redirect('/login?sent=1');
  }

  const supabase = await getSupabaseServerClient();
  const hdrs = await headers();
  // Prefer the proxy-forwarded origin (Vercel sets x-forwarded-host) so the
  // redirect lands on the deployed URL, not localhost. Fall back to origin
  // for local dev.
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000';
  const origin = `${proto}://${host}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/admin`,
    },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect('/login?sent=1');
}

export async function signOut() {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// ---------------------------------------------------------------------------
// Alert lifecycle
// ---------------------------------------------------------------------------

export async function acknowledgeAlert(formData: FormData) {
  const gate = await requireAdmin();
  if ('error' in gate) return;
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  const admin = getSupabaseAdminClient();
  await admin.from('system_alerts').update({ acknowledged_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/admin');
}

export async function resolveAlert(formData: FormData) {
  const gate = await requireAdmin();
  if ('error' in gate) return;
  const id = Number(formData.get('id'));
  if (!Number.isFinite(id)) return;
  const admin = getSupabaseAdminClient();
  await admin.from('system_alerts').update({ resolved_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/admin');
}

// ---------------------------------------------------------------------------
// Firm lifecycle
// ---------------------------------------------------------------------------

export async function toggleFirmActive(formData: FormData) {
  const gate = await requireAdmin();
  if ('error' in gate) return;
  const id = String(formData.get('id') ?? '');
  const next = String(formData.get('next') ?? '') === 'true';
  if (!id) return;
  const admin = getSupabaseAdminClient();
  await admin.from('firms').update({ active: next }).eq('id', id);
  revalidatePath('/admin');
}

export async function resetFirmBackoff(formData: FormData) {
  const gate = await requireAdmin();
  if ('error' in gate) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const admin = getSupabaseAdminClient();
  await admin
    .from('firms')
    .update({ consecutive_errors: 0, next_run_after: null })
    .eq('id', id);
  revalidatePath('/admin');
}

// ---------------------------------------------------------------------------
// Force-run a poller
// ---------------------------------------------------------------------------

const VALID_FN_NAMES = new Set([
  'poll-workday', 'poll-greenhouse', 'poll-lever', 'poll-workable', 'poll-teamtailor',
  'poll-smartrecruiters', 'poll-oracle-hcm', 'poll-eightfold', 'poll-oleeo', 'poll-avature',
  'poll-watchdog', 'poll-daily-digest', 'poll-host-probe', 'poll-careers-scan',
  'poll-ats-discover',
]);

// ---------------------------------------------------------------------------
// ATS auto-discovery (Tier 6)
// ---------------------------------------------------------------------------

import type { Database } from '@/types/supabase';

type AtsType = Database['public']['Enums']['ats_type'];

export interface DiscoveryCandidate {
  ats: string;
  ats_config: Record<string, unknown>;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  sample?: { title: string; location: string | null; apply_url: string };
}

export interface DiscoveryResult {
  ok: boolean;
  careers_url: string;
  status_code: number | null;
  candidates: DiscoveryCandidate[];
  vendor_signals: string[];
  error?: string;
}

// Invoked from /admin/discover by a form action. Calls poll-ats-discover via
// the project's public Edge Function URL (rather than the SQL helper) so we
// can return the body directly to the page; _invoke_poller is fire-and-
// forget and doesn't surface the function's response.
export async function discoverAts(careersUrl: string): Promise<DiscoveryResult> {
  const gate = await requireAdmin();
  if ('error' in gate) {
    return { ok: false, careers_url: careersUrl, status_code: null, candidates: [], vendor_signals: [], error: gate.error };
  }
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl || !serviceKey) {
    return { ok: false, careers_url: careersUrl, status_code: null, candidates: [], vendor_signals: [], error: 'missing_env' };
  }
  try {
    const res = await fetch(`${projectUrl}/functions/v1/poll-ats-discover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ careers_url: careersUrl }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, careers_url: careersUrl, status_code: res.status, candidates: [], vendor_signals: [], error: text.slice(0, 300) };
    }
    return (await res.json()) as DiscoveryResult;
  } catch (err) {
    return { ok: false, careers_url: careersUrl, status_code: null, candidates: [], vendor_signals: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// Insert a new firm row from a discovery candidate. Used by the "Insert as
// firm" buttons on /admin/discover. Returns redirect to the cockpit; the
// new firm appears in FirmsTable on next render.
export async function insertFirmFromDiscovery(formData: FormData) {
  const gate = await requireAdmin();
  if ('error' in gate) return;
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const ats = String(formData.get('ats') ?? '').trim() as AtsType;
  const careersUrl = String(formData.get('careers_url') ?? '').trim();
  const atsConfigRaw = String(formData.get('ats_config') ?? '{}');
  if (!slug || !name || !ats) return;
  let atsConfig: unknown;
  try {
    atsConfig = JSON.parse(atsConfigRaw);
  } catch {
    return; // bad JSON; silently drop — UI shows the raw config so the
            // operator can correct it before submitting again.
  }
  const admin = getSupabaseAdminClient();
  await admin.from('firms').insert({
    slug,
    name,
    ats,
    careers_url: careersUrl || null,
    ats_config: atsConfig as Database['public']['Tables']['firms']['Insert']['ats_config'],
    active: false, // operator must explicitly activate via the cockpit
  });
  revalidatePath('/admin');
  redirect('/admin?firms=inactive');
}

export async function forceRunPoller(formData: FormData) {
  const gate = await requireAdmin();
  if ('error' in gate) return;
  const fn = String(formData.get('fn') ?? '');
  if (!VALID_FN_NAMES.has(fn)) return;

  // Invoke via the _invoke_poller SQL helper rather than calling the Edge
  // Function URL directly. Two reasons:
  //   1. The helper pulls credentials from Vault, so the action doesn't
  //      need the service role key in env — though we already use it for
  //      the admin client, going through Vault keeps the surface uniform.
  //   2. The helper handles missing-secret degradation via system_alerts,
  //      so a force-run with broken vault state surfaces the same way as
  //      a cron tick would.
  const admin = getSupabaseAdminClient();
  await admin.rpc('_invoke_poller', { fn });
  revalidatePath('/admin');
}
