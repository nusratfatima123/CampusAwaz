import { createClient as createSupabaseClient } from '@supabase/supabase-js';
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
    try {
      const cookieStore = cookies();
      const projectRef = new URL(url).hostname.split('.')[0];
      const raw = cookieStore.get(`sb-${projectRef}-auth-token`)?.value;
      if (raw) {
        const parsed = JSON.parse(raw);
        const access_token =
          parsed?.access_token ?? parsed?.session?.access_token;
        if (access_token) {
          return createSupabaseClient<Database>(url, anonKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
              detectSessionInUrl: false,
            },
            global: {
              headers: {
                Authorization: `Bearer ${access_token}`,
              },
            },
          });
        }
      }
    } catch {
      // cookies unavailable or token unparseable — fall through
    }
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
