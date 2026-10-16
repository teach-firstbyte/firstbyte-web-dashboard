import { findUserByEmail } from "@/server/users/queries";
import { createClient } from "../supabase/server";
import { asViewer, type Viewer } from "@/server/viewer";

/**
 * The Viewer for the current session, or null (null = no session, or authed but
 * no Prisma row yet).
 *
 * This is one of the four places allowed to call asViewer(). It earns that by
 * taking the email from supabase.auth.getUser(), which round-trips the token to
 * the Supabase auth server for verification -- not from getSession(), which
 * only reads the cookie and believes it.
 *
 * That round trip is also what locks out a deleted account at once. Deleting a
 * Supabase login does not cancel the access token the person already holds:
 * it stays valid for up to an hour. getUser() asks the server, which answers
 * "user does not exist". getSession() and getClaims() check the token locally,
 * so switching to either would let a deleted person keep using the dashboard
 * until their token expires.
 */
export async function getCurrentUser(): Promise<Viewer | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  const user = await findUserByEmail(authUser.email);

  return user ? asViewer(user) : null;
}
