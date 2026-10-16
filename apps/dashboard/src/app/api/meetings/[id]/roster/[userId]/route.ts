import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { markOnRoster } from "@/server/attendance/mutations";
import { rosterMarkSchema } from "@/server/attendance/schema";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

/**
 * Marks one person Present, Excused or Absent at a meeting, or clears them
 * back to not marked with `{ status: null }`. Officers only.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  const { user, error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id, userId } = await params;
    const input = await parseJsonBody(request, rosterMarkSchema);
    const record = await markOnRoster(
      user,
      requireId(id, "meeting"),
      requireId(userId, "user"),
      input,
    );
    return NextResponse.json(record, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "PUT /api/meetings/[id]/roster/[userId]",
      "Failed to save attendance",
    );
  }
}
