import { NextResponse } from "next/server";
import { verifyCheckInCode } from "@/lib/attendance/check-in-code";
import { requireCheckInUser } from "@/lib/auth/requireCheckInUser";
import { checkInToMeeting } from "@/server/attendance/mutations";
import { checkInSchema } from "@/server/attendance/schema";
import { ServiceError } from "@/server/errors";
import { parseJsonBody, toErrorResponse } from "@/server/http";

/**
 * Marks the caller present at a meeting, from a scanned QR code.
 *
 * The subject is always the caller. There is no userId in the body, and there
 * must never be one -- that would let anyone mark anyone present.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { user, error } = await requireCheckInUser();
  if (error) return error;

  try {
    const { meetingId, code } = await parseJsonBody(request, checkInSchema);

    // HMAC over the meeting id, so a guessed URL is not a check-in. Checked
    // here rather than in the service because it is a property of the link the
    // request arrived on, not of the attendance record.
    if (!verifyCheckInCode(meetingId, code)) {
      throw new ServiceError("FORBIDDEN", "Invalid check-in code");
    }

    const attendance = await checkInToMeeting(user, meetingId);
    return NextResponse.json(attendance, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "POST /api/attendance/check-in",
      "Failed to check in",
    );
  }
}
