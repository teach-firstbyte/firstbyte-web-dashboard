import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import {
  deleteAttendance,
  updateAttendance,
} from "@/server/attendance/mutations";
import { getAttendanceById } from "@/server/attendance/queries";
import { updateAttendanceSchema } from "@/server/attendance/schema";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Gets a single attendance record by id.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const attendance = await getAttendanceById(requireId(id, "attendance"));
    return NextResponse.json(attendance, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/attendance/[id]",
      "Failed to get attendance",
    );
  }
}

/**
 * Updates an attendance record's status, check-in/out times, and/or notes.
 *
 * Returns the bare row. AttendanceToggle reads `updated.status` off this to
 * reconcile its optimistic update.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, updateAttendanceSchema);
    const updated = await updateAttendance(requireId(id, "attendance"), input);
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "PUT /api/attendance/[id]",
      "Failed to update attendance",
    );
  }
}

/**
 * Deletes an attendance record by id.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const attendance = await deleteAttendance(requireId(id, "attendance"));
    return NextResponse.json(
      { message: "Attendance deleted successfully", attendance },
      { status: 200 },
    );
  } catch (e) {
    return toErrorResponse(
      e,
      "DELETE /api/attendance/[id]",
      "Failed to delete attendance",
    );
  }
}
