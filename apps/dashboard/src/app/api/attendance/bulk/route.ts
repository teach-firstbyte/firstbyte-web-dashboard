import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { setAttendanceStatusBulk } from "@/server/attendance/mutations";
import { bulkAttendanceStatusSchema } from "@/server/attendance/schema";
import { parseJsonBody, toErrorResponse } from "@/server/http";

/**
 * Sets several roster rows of one meeting to one status. Officers only.
 * "Mark the rest absent" on the attendance page, and its Undo.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const input = await parseJsonBody(request, bulkAttendanceStatusSchema);
    return NextResponse.json(await setAttendanceStatusBulk(input), {
      status: 200,
    });
  } catch (e) {
    return toErrorResponse(
      e,
      "PATCH /api/attendance/bulk",
      "Failed to update attendance",
    );
  }
}
