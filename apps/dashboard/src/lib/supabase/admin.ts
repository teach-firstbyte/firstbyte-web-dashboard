import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * A Supabase client with the project's secret key, for the few things the
 * anon key cannot do -- today, only removing a login when an account is
 * deleted.
 *
 * Use a secret key (sb_secret_...) from Settings -> API Keys. Supabase is
 * retiring the legacy service_role JWT by the end of 2026; it still works here
 * until it is disabled, but a secret key also refuses requests that come from
 * a browser, which the legacy key does not.
 *
 * Either key skips every Supabase access rule, so it is server-only twice
 * over: the "server-only" import above fails the build if a client component
 * imports this file, and the variable has no NEXT_PUBLIC_ prefix, so Next.js
 * never puts it in a browser bundle.
 *
 * Throws when the key is not set. Callers create the client before they change
 * anything, so a missing key stops the whole action instead of leaving it half
 * done.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    // No user session lives in this client. It acts as the server itself.
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type AdminClient = ReturnType<typeof createAdminClient>;

/** Large enough that a club this size usually fits in one page. */
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
    let page: number | null = 1;
    while (page !== null) {
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

      // Follows Supabase's own nextPage rather than guessing from a short
      // page: the server may cap perPage below what was asked for, and a
      // guess would then stop early and miss the login.
      page = data.nextPage;
    }

    // No login is fine: an account can exist without one, e.g. after a reset
    // of the local Supabase.
    return true;
  } catch (error) {
    console.error(`removeLoginByEmail failed for ${email}:`, error);
    return false;
  }
}
