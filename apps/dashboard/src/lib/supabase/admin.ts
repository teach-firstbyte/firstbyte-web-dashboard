import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * A Supabase client with the service role key, for the few things the anon
 * key cannot do -- today, only removing a login when someone deletes their
 * account.
 *
 * The service role key skips every Supabase access rule, so it is server-only
 * twice over: the "server-only" import above fails the build if a client
 * component imports this file, and the variable has no NEXT_PUBLIC_ prefix, so
 * Next.js never puts it in a browser bundle.
 *
 * Throws when the key is not set. Callers create the client before they change
 * anything, so a missing key stops the whole action instead of leaving it half
 * done.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    // No user session lives in this client. It acts as the server itself.
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
