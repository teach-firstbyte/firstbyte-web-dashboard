import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/lib/auth/requireOfficerApi";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { createMeetingWithRoster } from "@/server/meetings/mutations";
import { listMeetingsForViewer } from "@/server/meetings/queries";
import { createMeetingSchema } from "@/server/meetings/schema";

/**
 * Gets the meetings the caller may see.
 * @returns the meetings, scoped to the caller
 */
export async function GET(): Promise<NextResponse> {
  // The auth gate stays at the edge: it is the only thing here that knows what
  // a 401 is. Who may see which meetings is the service's job.
  const { user, error } = await requireUserApi();
  if (error) return error;

  try {
    const meetings = await listMeetingsForViewer(user);
    return NextResponse.json(meetings, { status: 200 });
  } catch (e) {
    return toErrorResponse(e, "GET /api/meetings", "Failed to get meetings");
  }
}

/**
 * Creates a new meeting and pre-registers its roster.
 * @param request - The request object
 * @returns The created meeting
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { error } = await requireOfficerApi();
  if (error) return error;

  try {
    const input = await parseJsonBody(request, createMeetingSchema);
    const meeting = await createMeetingWithRoster(input);
    return NextResponse.json(meeting, { status: 201 });
  } catch (e) {
    return toErrorResponse(e, "POST /api/meetings", "Failed to create meeting");
  }
}
