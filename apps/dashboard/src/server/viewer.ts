import type { User } from "@prisma/client";

declare const brand: unique symbol;

/**
 * A user whose identity came from the session cookie, confirmed by Supabase.
 *
 * `brand` is a property that exists only in the type system -- no runtime value
 * ever carries it. That makes a Viewer impossible to write by hand and
 * impossible to cast a parsed request body into. Only asViewer() produces one,
 * and only the auth gates call asViewer().
 *
 * So a service that asks for a Viewer is asking for a caller the server
 * authenticated, and the compiler enforces it:
 *
 *   const body = await request.json();
 *   await listMeetingsForViewer(body.user);   // <- does not compile
 *
 * Without the brand that line typechecks, and it is a privilege-escalation
 * hole: the caller picks whose data they read.
 */
export type Viewer = User & { readonly [brand]: "viewer" };

/**
 * CAUTION: call this only from src/lib/auth/, on a row that was looked up by an
 * email Supabase confirmed. Calling it on request data defeats the entire type.
 * There is no lint rule protecting this -- treat a new call site as a security
 * change in review.
 */
export function asViewer(user: User): Viewer {
  return user as Viewer;
}
