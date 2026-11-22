import type { Viewer } from "@/server/viewer";
import { canAccessTasks } from "@/lib/auth/taskPolicy";
import { selectMyTasks } from "@/lib/tasks/home";
import { clubToday, getTaskActor, listTasks, type TaskView } from "./queries";

/**
 * The My tasks card on Home.
 *
 * - `ready`: the viewer's open tasks that are overdue or due in the next 7
 *   days (Boston), soonest first, with the overdue count and how many more
 *   are due later.
 * - `unavailable`: the task query failed. The card says so and the rest of
 *   Home renders as usual.
 */
export type HomeTasks =
  | {
      kind: "ready";
      tasks: TaskView[];
      overdue: number;
      later: number;
      /** Today in Boston, "YYYY-MM-DD", for the due labels. */
      today: string;
    }
  | { kind: "unavailable" };

/**
 * The card's data, or null when the viewer can't open Tasks and gets no card.
 *
 * Never throws, so Home can start it alongside its own queries and await it
 * later. The access check comes first: someone off the e-board costs one
 * lookup of their own membership and no task query at all, so nothing
 * task-related can fail on their Home.
 */
export async function getHomeTasks(viewer: Viewer): Promise<HomeTasks | null> {
  let canUse: boolean;
  try {
    canUse = canAccessTasks(await getTaskActor(viewer));
  } catch (error) {
    // Without an answer, hide the card rather than show it to someone who
    // may not be on the e-board.
    console.error("My tasks access check failed:", error);
    return null;
  }
  if (!canUse) return null;

  try {
    const today = clubToday();
    const tasks = await listTasks(viewer, {
      ownerId: viewer.id,
      includeDone: false,
    });
    const { due, overdue, later } = selectMyTasks(tasks, viewer.id, today);
    return { kind: "ready", tasks: due, overdue, later, today };
  } catch (error) {
    console.error("My tasks query failed:", error);
    return { kind: "unavailable" };
  }
}
