import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { listMeetingRoster } from "@/server/attendance/queries";
import { toErrorResponse } from "@/server/http";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * The officer roster for one meeting: everyone it is for, marked or not, plus
 * walk-ins. Officers only.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const roster = await listMeetingRoster(requireId(id, "meeting"));
    return NextResponse.json(roster, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/meetings/[id]/roster",
      "Failed to load the roster",
    );
  }
}
