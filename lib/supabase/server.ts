import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import type { Database } from '@/types/supabase';

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch (err) {
          // Next.js forbids cookie mutations from inside a Server Component
          // render path. The Supabase SSR docs recommend ignoring that one
          // specific error, but a blanket catch hides real failures
          // (oversized cookies, refresh-token write errors) that will silently
          // break Phase 2 auth. Narrow the swallow to the known RSC case and
          // log everything else as structured JSON so it surfaces in `next
          // dev` and Vercel logs.
          const message = err instanceof Error ? err.message : String(err);
          const isRscMutation =
            message.includes('Cookies can only be modified') ||
            message.includes('cookies() in a Server Component');
          if (!isRscMutation) {
            console.error(
              JSON.stringify({ at: 'supabase.setAll', level: 'error', message }),
            );
          }
        }
      },
    },
  });
}
