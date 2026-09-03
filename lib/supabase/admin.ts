import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES Row Level Security entirely, so it
 * must only ever be used inside server actions that have already verified the
 * caller is an admin. Never import this into a Client Component.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. Add it to .env.local and to the Vercel project environment variables (Supabase → Project Settings → API keys → secret key).",
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
