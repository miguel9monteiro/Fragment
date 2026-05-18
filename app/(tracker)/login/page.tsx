// Magic-link login. The form submits to the sendMagicLink server action,
// which (1) refuses to send for any email not in the ADMIN_EMAIL allowlist
// (silently — the response is identical to a success to prevent enumeration),
// (2) calls Supabase Auth's OTP flow with the deployed origin as the
// redirect target, (3) redirects to ?sent=1 so the page renders a "check
// your inbox" state.
//
// This page is intentionally outside /admin: the layout there forces
// authentication, which would loop on /admin/login.

import Link from 'next/link';

import { sendMagicLink } from '../admin/_actions';

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Whitelist of post-login destinations. Keep in sync with sendMagicLink's
// ALLOWED_NEXT_PATHS — anything not on this list collapses to /admin so the
// hidden form input can't be used as an open-redirect vector.
const ALLOWED_NEXT_PATHS = new Set(['/admin', '/jobs']);

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const sent = params.sent === '1';
  const errorRaw = Array.isArray(params.error) ? params.error[0] : params.error;
  const error = typeof errorRaw === 'string' ? errorRaw : null;
  const nextRaw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = typeof nextRaw === 'string' && ALLOWED_NEXT_PATHS.has(nextRaw) ? nextRaw : '/admin';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Fragment Tracker
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Magic-link sign-in to the admin cockpit. Requests from unauthorised
          addresses are silently ignored.
        </p>
      </div>

      {sent ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          <p className="font-medium">Check your inbox.</p>
          <p className="mt-1 opacity-80">
            If the address is authorised, a magic link is on its way. It expires in
            a few minutes — open the most recent one.
          </p>
        </div>
      ) : (
        <form action={sendMagicLink} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none ring-0 focus:border-foreground focus:ring-2 focus:ring-foreground/10"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-700 dark:text-red-400">
              {error === 'missing-email' ? 'Email is required.' : error}
            </p>
          ) : null}
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Send magic link
          </button>
        </form>
      )}

      <p className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          ← Back to site
        </Link>
      </p>
    </main>
  );
}
