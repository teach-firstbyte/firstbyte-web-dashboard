import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "@prisma/client";
import { findUserByEmail } from "@/server/users/queries";
import { createClient } from "../supabase/server";

/**
 * Supabase auth.users and Prisma public.users are joined by email only -- there
 * is no FK and no supabase_uid column -- so "has a session" and "has a row" are
 * genuinely independent states.
 *
 * getCurrentUser() collapses both into null, which is why a signed-in user with
 * no row gets bounced to /login, still has a valid session there, and loops. The
 * approval gate has to tell them apart: no session means log in, no row means
 * the row was never created and should be.
 */
export type SessionState =
  | { kind: "anonymous" }
  | { kind: "orphaned"; authUser: SupabaseUser }
  | { kind: "known"; authUser: SupabaseUser; user: User };

export async function getSession(): Promise<SessionState> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return { kind: "anonymous" };

  const user = await findUserByEmail(authUser.email);

  return user
    ? { kind: "known", authUser, user }
    : { kind: "orphaned", authUser };
}
