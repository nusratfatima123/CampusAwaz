import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Service-role Supabase client for trusted server-only operations
 * (OTP hashing/verification, storage uploads, audit writes).
 *
 * SECURITY: never import this from a Client Component. The service role key
 * bypasses RLS entirely.
 *
 * FALLBACK: when SUPABASE_SERVICE_ROLE_KEY has not been configured (i.e. it is
 * the same as the anon key), the function returns an authenticated session
 * client instead so that RLS policies apply rather than every operation failing
 * silently.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Server-side privileged operations are unavailable.'
    );
  }

  if (serviceKey === anonKey) {
    // Fallback: use createServerClient to properly handle the authenticated session
    try {
      const cookieStore = cookies();
      return createServerClient<Database>(url, anonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Called from a Server Component — the cookie store is read-only.
            }
          },
        },
      });
    } catch {
      // cookies unavailable — fall through to service client
    }
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
