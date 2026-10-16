import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { closeOverdueMeetings } from "@/server/attendance/mutations";
import { toErrorResponse } from "@/server/http";

/**
 * Closes attendance for meetings that started more than 3 hours ago and that
 * no officer closed. Vercel Cron calls this every hour (see vercel.json), on
 * the production deployment only.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET set,
 * every request is refused, so nobody can trigger it by guessing the URL.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const sent = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  if (
    !secret ||
    sent.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sent), Buffer.from(expected))
  ) {
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
