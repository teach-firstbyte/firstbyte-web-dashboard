import { redirect } from "next/navigation";
import { getTaskActor } from "@/server/tasks/queries";
import type { Viewer } from "@/server/viewer";
import { requireApprovedUser } from "./requireApprovedUser";
import { canManageSlackLinks } from "./taskPolicy";

/**
 * The gate for /tasks/slack: approved, and a super admin. Anyone else goes to
 * Home, the same as requireTaskAccess does for the rest of Tasks.
 */
export async function requireSlackSetupAccess(): Promise<Viewer> {
  const user = await requireApprovedUser("/tasks/slack");
  if (!canManageSlackLinks(await getTaskActor(user))) redirect("/");
  return user;
}
