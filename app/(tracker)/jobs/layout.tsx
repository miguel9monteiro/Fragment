// Auth + email-allowlist gate for /jobs. Mirrors /admin/layout.tsx exactly:
// the /jobs surface is hidden from public nav pending PMC board approval, and
// also locked at the auth layer so direct-URL access requires a magic-link
// login from an ADMIN_EMAIL address. When the board signs off, delete this
// file (or replace it with a passthrough) and the route reverts to public.
//
// Three states:
//   1. Not signed in           -> redirect to /login?next=/jobs
//   2. Signed in, wrong email  -> render Forbidden() with a sign-out button
//   3. Signed in, allowed      -> render the public-style jobs page below

import { redirect } from 'next/navigation';

import { signOut } from '../admin/_actions';
import { getSupabaseServerClient } from '@/tracker/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_EMAILS = (process.env.ADMIN_EMAIL ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export default async function JobsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/jobs');

  const email = user.email?.toLowerCase();
  if (!email || ADMIN_EMAILS.length === 0 || !ADMIN_EMAILS.includes(email)) {
    return <Forbidden email={email ?? 'unknown'} />;
  }

  return <>{children}</>;
}

function Forbidden({ email }: { email: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="font-mono">{email}</span>, which is not on the
        allowlist. Sign out and try a different address.
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
