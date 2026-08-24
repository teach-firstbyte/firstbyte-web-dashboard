import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserToDb } from "./sync-user";
import { isApproved } from "./accountGate";
import { asViewer, type Viewer } from "@/server/viewer";

type CheckInResult =
  { user: Viewer; error: null } | { user: null; error: NextResponse };

/**
 * The API gate for the QR check-in route.
 *
 * Separate from requireUserApi for one reason: a QR deep link is the most
 * likely way a brand-new account reaches this app, and such an account has a
 * Supabase session but no `users` row yet. requireUserApi reads that as "not
 * authenticated" and returns a 401, which is wrong -- the person is signed in,
 * their row simply has not been created. So this heals the row first, the same
 * way /auth/callback does, and only then applies the status gate.
 *
 * Everything else matches requireUserApi exactly, including the 403 body. This
 * exists so that check-in's auth is one named gate rather than thirty lines
 * hand-written inside a route handler, which is what it was.
 */
export async function requireCheckInUser(): Promise<CheckInResult> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) {
    return {
      user: null,
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  // upsert, so a first-time scanner gets a row instead of a 404.
  const user = await syncUserToDb(authUser);

  // The gate this route would otherwise miss. Without it, an un-approved
  // account scanning a meeting QR creates an attendance record.
  if (!isApproved(user)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Account is not approved", status: user.status },
        { status: 403 },
      ),
    };
  }

  return { user: asViewer(user), error: null };
}
