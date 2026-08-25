import type { User as SupabaseUser } from "@supabase/supabase-js";
import { upsertUserByEmail } from "@/server/users/mutations";

/**
 * Creates the Prisma row for a Supabase account that does not have one yet.
 *
 * The email is non-null by the time this is called -- every caller reaches it
 * through a session whose email Supabase confirmed.
 */
export async function syncUserToDb(supabaseUser: SupabaseUser) {
  return upsertUserByEmail(
    supabaseUser.email!,
    supabaseUser.user_metadata?.full_name ?? null,
  );
}
