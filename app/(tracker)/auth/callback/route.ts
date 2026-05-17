// Magic-link callback. Supabase Auth sends the user here with a short-lived
// `code` in the query string after they click the email link. We exchange
// the code for a session (Supabase sets the cookies via the server client's
// setAll handler) and redirect to the post-login destination — `next` if
// the link carried it, /admin otherwise.
//
// On exchange failure we send the user back to /login with the error, so
// magic-link expiry or replay attempts surface a readable message rather
// than a silent dead-end.
import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/tracker/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/admin';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing-code', request.url));
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
