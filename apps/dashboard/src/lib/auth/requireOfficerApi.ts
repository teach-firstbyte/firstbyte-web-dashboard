import { NextResponse } from "next/server";
import { getCurrentUser } from "./getCurrentUser";
import { isOfficer } from "./roles";
import { isApproved } from "./accountGate";
import type { Viewer } from "@/server/viewer";

type OfficerApiResult =
  { user: Viewer; error: null } | { user: null; error: NextResponse };

export async function requireOfficerApi(): Promise<OfficerApiResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  // An unapproved officer should not exist, but role and status are independent
  // so the check is worth its two lines.
  if (!isApproved(user)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Account is not approved", status: user.status },
        { status: 403 },
      ),
    };
  }
  if (!isOfficer(user)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, error: null };
}
