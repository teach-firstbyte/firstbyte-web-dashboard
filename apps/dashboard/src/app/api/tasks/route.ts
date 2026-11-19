import { after, NextResponse } from "next/server";
import { requireTaskAccessApi } from "@/lib/auth/requireTaskAccessApi";
import { parseJsonBody, parseOrThrow, toErrorResponse } from "@/server/http";
import { createTask } from "@/server/tasks/mutations";
import { deliverRemindersForTask } from "@/server/tasks/reminders";
import { listTasks } from "@/server/tasks/queries";
import { createTaskSchema, listTasksSchema } from "@/server/tasks/schema";

/**
 * Lists tasks, soonest due first. E-board members and super admins only.
 *
 * Optional filters: ?ownerId=12 for one person's tasks, ?meetingId=7 for the
 * ones from one meeting, ?includeDone=false to leave out Done tasks.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { user, error } = await requireTaskAccessApi();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const filters = parseOrThrow(listTasksSchema, {
      ownerId: searchParams.get("ownerId") ?? undefined,
      meetingId: searchParams.get("meetingId") ?? undefined,
      includeDone: searchParams.get("includeDone") ?? undefined,
    });
    const tasks = await listTasks(user, filters);
    return NextResponse.json(tasks, { status: 200 });
  } catch (e) {
    return toErrorResponse(e, "GET /api/tasks", "Failed to get tasks");
  }
}

/**
 * Creates a task. The signed-in person becomes its creator.
 * Body: { title, ownerId, dueDate: "YYYY-MM-DD", status?, teamId?, meetingId?, notes? }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { user, error } = await requireTaskAccessApi();
  if (error) return error;

  try {
    const input = await parseJsonBody(request, createTaskSchema);
    const task = await createTask(user, input);
    // The "assigned" Slack DM, sent after the response so Slack never slows
    // the save. The hourly job sends it if this doesn't.
    after(() => deliverRemindersForTask(task.id));
    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    return toErrorResponse(e, "POST /api/tasks", "Failed to create task");
  }
}
