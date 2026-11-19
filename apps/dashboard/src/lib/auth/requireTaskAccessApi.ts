import { NextResponse } from "next/server";
import { getTaskActor } from "@/server/tasks/queries";
import type { Viewer } from "@/server/viewer";
import { requireUserApi } from "./requireUserApi";
import { canAccessTasks } from "./taskPolicy";

type TaskApiResult =
  { user: Viewer; error: null } | { user: null; error: NextResponse };

/**
 * requireUserApi, plus: on the e-board or a super admin. Anyone else gets a
 * 403 before the body is read.
 *
 * The services in server/tasks check the same rule again (assertTaskAccess),
 * so a route that forgot this gate would still refuse. This one is here so
 * every task route answers the same way, with the same message.
 */
export async function requireTaskAccessApi(): Promise<TaskApiResult> {
  const { user, error } = await requireUserApi();
  if (error) return { user: null, error };

  if (!canAccessTasks(await getTaskActor(user))) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Tasks are only for e-board members." },
        { status: 403 },
      ),
    };
  }
  return { user, error: null };
}
