/**
 * What the My tasks card on Home picks out of the viewer's tasks.
 *
 * Pure and import-free apart from board.ts (itself import-free), so
 * `node --test` loads it as it is and the client bundle gets no server code.
 * home.test.ts covers it. Dates are "YYYY-MM-DD" strings, and "today" is the
 * server's Boston date (clubToday), as on the board.
 */
import { compareTasks, daysFrom, type BoardTaskFields } from "./board.ts";

/** How far ahead the card looks: today and the six days after it. */
export const HOME_TASK_DAYS = 7;

export type MyTasksSelection<T> = {
  /** Overdue, or due within HOME_TASK_DAYS. Soonest first, so overdue lead. */
  due: T[];
  /** How many of `due` are overdue, for the amber count. */
  overdue: number;
  /** Open tasks due after that, for the "N more due later" line. */
  later: number;
};

/**
 * The viewer's open tasks that are overdue or due in the next week, and how
 * many more are due after that. Done tasks and other people's tasks are left
 * out, whatever the caller passed in.
 *
 * Overdue is read from the dates, not the task's isOverdue flag, so a task
 * always lands in exactly one of `due` or `later` against the same `today`.
 */
export function selectMyTasks<T extends BoardTaskFields>(
  tasks: readonly T[],
  viewerId: number,
  today: string,
): MyTasksSelection<T> {
  const open = tasks
    .filter((t) => t.ownerId === viewerId && t.status !== "DONE")
    .slice()
    .sort(compareTasks);
  const due = open.filter((t) => daysFrom(today, t.dueDate) < HOME_TASK_DAYS);
  return {
    due,
    overdue: due.filter((t) => daysFrom(today, t.dueDate) < 0).length,
    later: open.length - due.length,
  };
}
