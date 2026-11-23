import { NextResponse } from "next/server";
import { isCronRequest } from "@/server/cron";
import { toErrorResponse } from "@/server/http";
import { runTaskReminders } from "@/server/tasks/reminders";
import { runWeeklySummary } from "@/server/tasks/weekly-summary";

/**
 * Sends the e-board's task reminders as Slack DMs: 2 days before a task is
 * due, on the due date and 1 day overdue, all from 9am Boston time, plus
 * retries of failed sends and any event DM (assigned, date changed) that
 * wasn't sent straight away. See server/tasks/reminders.ts.
 *
 * Then the weekly summary to the super admins, at the day and hour set on
 * Slack setup (server/tasks/weekly-summary.ts). Each part runs even if the
 * other fails.
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

  // One after the other (Slack rate-limits bursts), each caught on its own.
  const now = new Date();
  const reminders = await settle(() => runTaskReminders({ now }));
  const summary = await settle(() => runWeeklySummary({ now }));

  if (!reminders.ok) {
    if (!summary.ok) {
      console.error("GET /api/cron/task-reminders summary:", summary.error);
    }
    return toErrorResponse(
      reminders.error,
      "GET /api/cron/task-reminders",
      "Failed to send task reminders",
    );
  }
  if (!summary.ok) {
    return toErrorResponse(
      summary.error,
      "GET /api/cron/task-reminders",
      "Failed to send the weekly task summary",
    );
  }
  return NextResponse.json(
    { ...reminders.value, summary: summary.value },
    { status: 200 },
  );
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

async function settle<T>(run: () => Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error };
  }
}
