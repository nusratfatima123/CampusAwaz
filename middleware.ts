import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';

/**
 * Route protection for CampusAwaz.
 *
 *  - `(auth)` routes require a Supabase session, else → /login?next=<path>
 *  - `/dashboard` and `/complaints` additionally require
 *    affiliation_status === 'verified', else → /pending
 *  - `/login` + `/register` bounce signed-in users onward (verified →
 *    /dashboard, otherwise → /verify)
 */

const AUTH_PREFIXES = [
  '/dashboard',
  '/verify',
  '/pending',
  '/profile',
  '/complaints',
  // Sprint 3 — staff intake queue. Role checks live in the page/route handlers.
  '/admin',
  // Sprint 4 — student tracking and notifications.
  '/tracking',
  '/notifications',
];
const GUEST_ONLY_PATHS = ['/login', '/register'];

/** Paths a signed-in but *unverified* user may still visit. */
const UNVERIFIED_ALLOWED_PREFIXES = ['/verify', '/pending'];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, response } = createMiddlewareClient(request);

  // Without Supabase env vars we cannot evaluate auth. Let public pages render
  // (they show a configuration warning) and keep protected pages inaccessible.
  if (!supabase) {
    if (matchesPrefix(pathname, AUTH_PREFIXES)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'not_configured');
      return NextResponse.redirect(url);
    }
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = matchesPrefix(pathname, AUTH_PREFIXES);
  const isGuestOnlyRoute = GUEST_ONLY_PATHS.includes(pathname);

  // --- Unauthenticated visitor on a protected route -------------------------
  if (isAuthRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (!user || (!isAuthRoute && !isGuestOnlyRoute)) {
    return response;
  }

  // --- Signed in: resolve verification state --------------------------------
  const { data: profile } = await supabase
    .from('profiles')
    .select('affiliation_status')
    .eq('id', user.id)
    .maybeSingle();

  const isVerified = profile?.affiliation_status === 'verified';

  // Already signed in on /login or /register → send onward.
  if (isGuestOnlyRoute) {
    const url = request.nextUrl.clone();
    url.pathname = isVerified ? '/dashboard' : '/verify';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Unverified user reaching for a verified-only area → /pending.
  if (!isVerified && !matchesPrefix(pathname, UNVERIFIED_ALLOWED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = '/pending';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Verified user has no reason to sit on /pending.
  if (isVerified && pathname === '/pending') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every path except Next.js internals, the auth callback and static
     * assets, so session cookies stay fresh across navigations.
     */
    '/((?!_next/static|_next/image|api/auth/callback|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
