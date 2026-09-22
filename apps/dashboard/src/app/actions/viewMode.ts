"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { isOfficer } from "@/lib/auth/roles";
import { VIEW_MODE_COOKIE, type ViewMode } from "@/lib/auth/viewMode";

/**
 * Switch the calling officer between the officer and member views.
 *
 * Gated on requireApprovedUser + isOfficer rather than on requireOfficer(). The
 * difference matters if requireOfficer ever learns to respect member view: the
 * exit door has to ignore the mode it is exiting, or an officer who switches to
 * member view can never switch back and is locked out of their own dashboard.
 *
 * The check is here at all because a server action is a public endpoint -- it
 * compiles to a POST route anyone can call -- so it re-authenticates rather
 * than trusting the button that called it. getViewMode would refuse to honour
 * the cookie for a member anyway; this just declines to set it in the first
 * place.
 */
export async function setViewMode(mode: ViewMode) {
  const user = await requireApprovedUser();
  if (!isOfficer(user)) return;

  const cookieStore = await cookies();

  if (mode === "member") {
    cookieStore.set(VIEW_MODE_COOKIE, "member", {
      path: "/",
      sameSite: "lax",
      // Not a security boundary -- the user can edit their own cookies in
      // devtools regardless, which is why getViewMode re-checks the role. This
      // only keeps page scripts out of it.
      httpOnly: true,
    });
  } else {
    cookieStore.delete(VIEW_MODE_COOKIE);
  }

  // Both forking pages are dynamic server components, so the new mode only
  // shows up once their trees are re-rendered.
  revalidatePath("/", "layout");
}
