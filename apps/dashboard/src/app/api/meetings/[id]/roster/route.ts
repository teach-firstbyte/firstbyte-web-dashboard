import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { listAttendanceRosterForMeeting } from "@/server/attendance/queries";
import { toErrorResponse } from "@/server/http";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Every member eligible for this meeting, with whatever Attendance status
 * they already have -- the roster the manual attendance page marks against.
 * Unlike the meeting's own `attendance` relation, this includes members who
 * became eligible after the meeting was created and so never got a
 * pre-seeded row.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const roster = await listAttendanceRosterForMeeting(
      requireId(id, "meeting"),
    );
    return NextResponse.json(roster, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/meetings/[id]/roster",
      "Failed to get meeting roster",
    );
  }
}
