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

type AdminClient = ReturnType<typeof createAdminClient>;

/** Large enough that a club this size fits in one page. */
const PAGE_SIZE = 1000;

/**
 * Removes the Supabase login that belongs to an email, for an officer deleting
 * someone else's account. (Deleting your own account already knows the login
 * id from the session, and calls admin.auth.admin.deleteUser directly.)
 *
 * Supabase has no "find user by email" call, and auth.users is joined to our
 * users table by email only, so this pages through the login list.
 *
 * Never throws, and returns whether it worked. The account is already
 * anonymized by the time this runs, so a failure here must not turn the whole
 * request into an error -- the person is out of the old account either way.
 */
export async function removeLoginByEmail(
  admin: AdminClient,
  email: string,
): Promise<boolean> {
  const wanted = email.toLowerCase();

  try {
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      });
      if (error) throw error;

      const login = data.users.find((u) => u.email?.toLowerCase() === wanted);
      if (login) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(
          login.id,
        );
        if (deleteError) throw deleteError;
        return true;
      }

      // A short page is the last one. No login is fine: an account can exist
      // without one, e.g. after a reset of the local Supabase.
      if (data.users.length < PAGE_SIZE) return true;
    }
  } catch (error) {
    console.error(`removeLoginByEmail failed for ${email}:`, error);
    return false;
  }
}
