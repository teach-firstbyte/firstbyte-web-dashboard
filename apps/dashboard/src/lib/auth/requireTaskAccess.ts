import { redirect } from "next/navigation";
import { getTaskActor } from "@/server/tasks/queries";
import { requireApprovedUser } from "./requireApprovedUser";
import { canAccessTasks, type TaskActor } from "./taskPolicy";
import type { Viewer } from "@/server/viewer";

/**
 * The gate for the Tasks pages: approved, and on the e-board or a super
 * admin. Anyone else goes to Home, as requireOfficer does.
 *
 * Returns the actor as well, so a page can decide which buttons to show with
 * the same taskPolicy functions the server enforces.
 */
export async function requireTaskAccess(): Promise<{
  user: Viewer;
  actor: TaskActor;
}> {
  const user = await requireApprovedUser();
  const actor = await getTaskActor(user);
  if (!canAccessTasks(actor)) redirect("/");
  return { user, actor };
}
