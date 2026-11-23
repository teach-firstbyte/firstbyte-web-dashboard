import { NextResponse } from "next/server";
import { requireSlackSetupApi } from "@/lib/auth/requireSlackSetupApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { summaryScheduleSchema } from "@/server/tasks/schema";
import {
  getSummarySetup,
  setSummarySchedule,
} from "@/server/tasks/weekly-summary";

const FORBIDDEN =
  "Only the president, VP and website lead can change the weekly summary.";

/**
 * The weekly task summary's day and hour (Boston time), when the next one
 * goes out, and which super admins get it. Super admins only: anyone else
 * gets a 403.
 */
export async function GET(): Promise<NextResponse> {
  const { user, error } = await requireSlackSetupApi(FORBIDDEN);
  if (error) return error;

  try {
    return NextResponse.json(await getSummarySetup(user), { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "GET /api/tasks/summary",
      "Failed to get the weekly summary setting",
    );
  }
}

/**
 * Changes when the weekly summary goes out. Super admins only. Body:
 * { day: 0-6 (0 is Sunday), hour: 0-23 }, Boston time. Answers like GET.
 */
export async function PUT(request: Request): Promise<NextResponse> {
  const { user, error } = await requireSlackSetupApi(FORBIDDEN);
  if (error) return error;

  try {
    const input = await parseJsonBody(request, summaryScheduleSchema);
    return NextResponse.json(await setSummarySchedule(user, input), {
      status: 200,
    });
  } catch (e) {
    return toErrorResponse(
      e,
      "PUT /api/tasks/summary",
      "Failed to save the weekly summary setting",
    );
  }
}
