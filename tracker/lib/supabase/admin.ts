// Service-role Supabase client for admin-only server code. Bypasses RLS;
// MUST only ever be imported from server-side code that has *already* gated
// access via the auth + email-allowlist check (see src/app/admin/layout.tsx).
//
// The `import 'server-only'` line is a Next.js convention that prevents the
// bundler from ever shipping this module to the client — if a client
// component imports it transitively the build fails with a clear error.
import 'server-only';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/tracker/types/supabase';

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdminClient() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. ' +
        'Set both in .env.local for local dev; in Vercel project settings for production.',
    );
  }
  cached = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
