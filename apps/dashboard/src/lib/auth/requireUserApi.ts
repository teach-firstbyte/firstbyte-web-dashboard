import { NextResponse } from "next/server";
import { getCurrentUser } from "./getCurrentUser";
import { isApproved } from "./accountGate";
import type { Viewer } from "@/server/viewer";

type UserApiResult =
  { user: Viewer; error: null } | { user: null; error: NextResponse };

export async function requireUserApi(): Promise<UserApiResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  // Folded in here rather than added as a third helper: every API route already
  // funnels through this or requireOfficerApi, so one check gates all of them
  // and is fail-closed for routes added later.
  if (!isApproved(user)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Account is not approved", status: user.status },
        { status: 403 },
      ),
    };
  }
  return { user, error: null };
}
