// Auth + email-allowlist gate for every /admin/* route. Three states:
//   1. Not signed in           -> redirect to /login
//   2. Signed in, wrong email  -> render Forbidden() with a sign-out button
//   3. Signed in, allowed      -> render the cockpit
//
// The allowlist is a comma-separated list of lowercase emails from the
// ADMIN_EMAIL env var. If unset, the gate is closed (no admin access).
// This is deliberate: an unset env var must not be the same as "anyone".

import { redirect } from 'next/navigation';

import { signOut } from './_actions';
import { getSupabaseServerClient } from '@/tracker/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_EMAILS = (process.env.ADMIN_EMAIL ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/admin');

  const email = user.email?.toLowerCase();
  if (!email || ADMIN_EMAILS.length === 0 || !ADMIN_EMAILS.includes(email)) {
    return <Forbidden email={email ?? 'unknown'} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <a href="/admin" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground">
              Fragment Tracker
            </a>
            <span aria-hidden className="text-muted-foreground">·</span>
            <a href="/admin" className="text-sm font-medium hover:text-foreground">Cockpit</a>
            <span aria-hidden className="text-muted-foreground">·</span>
            <a href="/admin/discover" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Add firm
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

function Forbidden({ email }: { email: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="font-mono">{email}</span>, which is not on the
        admin allowlist. Sign out and try a different address.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
