import { NextResponse } from "next/server";
import { isCronRequest } from "@/server/cron";
import { toErrorResponse } from "@/server/http";
import { runTaskReminders } from "@/server/tasks/reminders";

/**
 * Sends the e-board's task reminders as Slack DMs: 2 days before a task is
 * due, on the due date and 1 day overdue, all from 9am Boston time, plus
 * retries of failed sends and any event DM (assigned, date changed) that
 * wasn't sent straight away. See server/tasks/reminders.ts.
 *
 * Vercel Cron calls it every hour (see vercel.json), on the production
 * deployment only. Running it twice, or twice at once, sends nothing twice.
 * Only Vercel Cron can call it: see isCronRequest.
 *
 * Answers with counts only, never member IDs or message text.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runTaskReminders(), { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/cron/task-reminders",
      "Failed to send task reminders",
    );
  }
}
