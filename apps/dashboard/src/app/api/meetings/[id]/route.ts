import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { deleteMeeting, updateMeeting } from "@/server/meetings/mutations";
import { getMeetingDetail } from "@/server/meetings/queries";
import { updateMeetingSchema } from "@/server/meetings/schema";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Gets a single meeting by id, including attendance and feedback.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const meeting = await getMeetingDetail(requireId(id, "meeting"));
    return NextResponse.json(meeting, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/meetings/[id]",
      "Failed to get meeting",
    );
  }
}

/**
 * Updates a meeting's details. All fields are optional; only the
 * provided ones are changed.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, updateMeetingSchema);
    const updated = await updateMeeting(requireId(id, "meeting"), input);
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "PUT /api/meetings/[id]",
      "Failed to update meeting",
    );
  }
}

/**
 * Deletes a meeting. Its attendance and feedback cascade.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const { id } = await params;
    const meeting = await deleteMeeting(requireId(id, "meeting"));
    return NextResponse.json(
      { message: "Meeting deleted successfully", meeting },
      { status: 200 },
    );
  } catch (e) {
    return toErrorResponse(
      e,
      "DELETE /api/meetings/[id]",
      "Failed to delete meeting",
    );
  }
}
