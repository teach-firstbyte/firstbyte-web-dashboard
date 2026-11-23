import { NextResponse } from "next/server";
import { closeOverdueMeetings } from "@/server/attendance/mutations";
import { isCronRequest } from "@/server/cron";
import { toErrorResponse } from "@/server/http";

/**
 * Closes attendance for meetings that started more than 3 hours ago and that
 * no officer closed. Vercel Cron calls this every hour (see vercel.json), on
 * the production deployment only.
 *
 * Only Vercel Cron can call it: see isCronRequest.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await closeOverdueMeetings(), { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/cron/close-attendance",
      "Failed to close attendance",
    );
  }
}
