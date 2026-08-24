import { prisma } from "../prisma";
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
 */
export async function getCurrentUser(): Promise<Viewer | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: authUser.email },
  });

  return user ? asViewer(user) : null;
}
