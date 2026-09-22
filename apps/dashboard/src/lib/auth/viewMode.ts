import { cookies } from "next/headers";
import { isOfficer } from "./roles";
import type { Viewer } from "@/server/viewer";

/**
 * Lets an officer preview the dashboard as a member sees it.
 *
 * This is a VIEW preference, not a permission. It picks which component renders
 * on the two pages that fork on audience (page.tsx and attendance/page.tsx);
 * it does not change what the services return, and it does not close the
 * officer-only pages or the /api routes -- those stay gated by requireOfficer
 * and requireOfficerApi, which never consult this file. An officer in member
 * view who types an officer URL still gets the officer page, by design.
 *
 * The member components are safe to hand an officer because they are already
 * viewer-scoped: getMemberDashboard and listAttendancePageForMember ask for
 * this person's own teams, meetings and attendance. So an officer previewing
 * sees their own real member data, not a mock.
 */

export const VIEW_MODE_COOKIE = "fb_view_mode";

export type ViewMode = "officer" | "member";

/**
 * The view to render for this viewer.
 *
 * Two inputs, and they are not equally trusted. `user.role` comes from the
 * database row behind a Supabase-verified session. The cookie comes from the
 * browser, and a cookie is editable by hand in devtools -- so it is treated as
 * a request, not a fact.
 *
 * The rule is that the cookie may only ever subtract. A non-officer returns
 * "member" before the cookie is read at all, and the only value that means
 * anything is the literal "member" -- there is no string a member could write
 * that reaches the officer branch.
 *
 * That guard is load-bearing rather than decorative: OfficerDashboard calls
 * getOfficerDashboard, whose listUsers() and listPendingUsers() are unscoped
 * and return the whole club. Rendering it for a member would be a real data
 * leak, not a cosmetic glitch.
 */
export async function getViewMode(user: Viewer): Promise<ViewMode> {
  if (!isOfficer(user)) return "member";

  const cookieStore = await cookies();

  return cookieStore.get(VIEW_MODE_COOKIE)?.value === "member"
    ? "member"
    : "officer";
}
