import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { closeAttendance } from "@/server/attendance/mutations";
import { toErrorResponse } from "@/server/http";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Close attendance: everyone expected who isn't Present or Excused becomes
 * Absent. Officers only. Safe to repeat.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { user, error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const result = await closeAttendance(user, requireId(id, "meeting"));
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "POST /api/meetings/[id]/close-attendance",
      "Failed to close attendance",
    );
  }
}
