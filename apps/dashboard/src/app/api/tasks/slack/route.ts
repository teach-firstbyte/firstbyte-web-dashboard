import { NextResponse } from "next/server";
import { requireSlackSetupApi } from "@/lib/auth/requireSlackSetupApi";
import { toErrorResponse } from "@/server/http";
import { listSlackSetup } from "@/server/tasks/slack-links";

/**
 * Every approved e-board member with their Slack member ID, or null when
 * they aren't linked. Super admins only: anyone else gets a 403.
 */
export async function GET(): Promise<NextResponse> {
  const { user, error } = await requireSlackSetupApi();
  if (error) return error;

  try {
    const rows = await listSlackSetup(user);
    return NextResponse.json(rows, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/tasks/slack",
      "Failed to get Slack links",
    );
  }
}
