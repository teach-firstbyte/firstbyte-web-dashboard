import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createAttendance } from "@/server/attendance/mutations";
import { listAttendanceForViewer } from "@/server/attendance/queries";
import {
  attendanceFilterSchema,
  createAttendanceSchema,
} from "@/server/attendance/schema";
import { parseJsonBody, parseOrThrow, toErrorResponse } from "@/server/http";

/**
 * Gets attendance records, optionally filtered by meeting or user.
 *
 * A non-officer always gets their own rows. The ?userId= filter is honored for
 * officers and overwritten for everybody else -- that rule lives in
 * listAttendanceForViewer, not here.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { user, error } = await requireUserApi();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const filter = parseOrThrow(attendanceFilterSchema, {
      meetingId: searchParams.get("meetingId") ?? undefined,
      userId: searchParams.get("userId") ?? undefined,
    });

    const attendance = await listAttendanceForViewer(user, filter);
    return NextResponse.json(attendance, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/attendance",
      "Failed to get attendance",
    );
  }
}

/**
 * Creates an attendance record for a user at a meeting. Officers only.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const input = await parseJsonBody(request, createAttendanceSchema);
    const attendance = await createAttendance(input);
    return NextResponse.json(attendance, { status: 201 });
  } catch (e) {
    return toErrorResponse(
      e,
      "POST /api/attendance",
      "Failed to create attendance",
    );
  }
}
