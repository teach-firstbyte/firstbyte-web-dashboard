import { NextResponse } from "next/server";
import { requireTaskAccessApi } from "@/lib/auth/requireTaskAccessApi";
import { parseJsonBody, toErrorResponse } from "@/server/http";
import { deleteTask, updateTask } from "@/server/tasks/mutations";
import { getTask } from "@/server/tasks/queries";
import { updateTaskSchema } from "@/server/tasks/schema";
import { requireId } from "@/server/validation";

type RouteContext = { params: Promise<{ id: string }> };

/** One task. E-board members and super admins only. */
export async function GET(request: Request, { params }: RouteContext) {
  const { user, error } = await requireTaskAccessApi();
  if (error) return error;

  try {
    const { id } = await params;
    const task = await getTask(user, requireId(id, "task"));
    return NextResponse.json(task, { status: 200 });
  } catch (e) {
    return toErrorResponse(e, "GET /api/tasks/[id]", "Failed to get task");
  }
}

/**
 * Changes the fields provided. The owner may send `status` only; the creator
 * and super admins may send any field. Anything else is a 403.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { user, error } = await requireTaskAccessApi();
  if (error) return error;

  try {
    const { id } = await params;
    const input = await parseJsonBody(request, updateTaskSchema);
    const task = await updateTask(user, requireId(id, "task"), input);
    return NextResponse.json(task, { status: 200 });
  } catch (e) {
    return toErrorResponse(e, "PATCH /api/tasks/[id]", "Failed to update task");
  }
}

/** Deletes a task. The creator or a super admin only. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { user, error } = await requireTaskAccessApi();
  if (error) return error;

  try {
    const { id } = await params;
    const deleted = await deleteTask(user, requireId(id, "task"));
    return NextResponse.json(deleted, { status: 200 });
  } catch (e) {
    return toErrorResponse(
      e,
      "DELETE /api/tasks/[id]",
      "Failed to delete task",
    );
  }
}
