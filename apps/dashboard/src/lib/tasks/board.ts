/**
 * The Tasks board's sorting, grouping and date wording.
 *
 * Pure and import-free, like lib/auth/taskPolicy.ts, so `node --test` loads it
 * as it is and the client bundle gets no server code. board.test.ts covers it.
 *
 * Every date here is a "YYYY-MM-DD" string with no time, as the API sends
 * dueDate. They are read as UTC midnights, only ever compared with each other,
 * so there is no time zone to get wrong. "Today" comes from the server
 * (clubToday, Boston), not the browser's clock.
 */

/** The fields of a TaskView the board reads. */
export type BoardTaskFields = {
  id: number;
  status: string;
  dueDate: string;
  ownerId: number;
  teamId: number | null;
  isOverdue: boolean;
  needsNewOwner: boolean;
};

const DAY_MS = 86_400_000;
const DONE = "DONE";

function utc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `today` to `iso`. Negative when it's in the past. */
export function daysFrom(today: string, iso: string): number {
  return Math.round((utc(iso) - utc(today)) / DAY_MS);
}

/** "YYYY-MM-DD" plus `n` days. */
export function addDays(iso: string, n: number): string {
  return new Date(utc(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

function format(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(utc(iso)).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}

/** "Fri, Nov 20" */
export function formatDueLong(iso: string): string {
  return format(iso, { weekday: "short", month: "short", day: "numeric" });
}

/** "Nov 20" */
export function formatDueShort(iso: string): string {
  return format(iso, { month: "short", day: "numeric" });
}

export type DueTone = "overdue" | "today" | "soon" | "later";

/**
 * What the right-hand column of a row says: "2 days overdue", "Due today",
 * "Due tomorrow", "Due Fri" within the week, "Due Nov 30" after that. A Done
 * task just shows its date.
 */
export function dueLabel(
  task: Pick<BoardTaskFields, "status" | "dueDate">,
  today: string,
): { text: string; tone: DueTone } {
  const n = daysFrom(today, task.dueDate);
  if (task.status === DONE) {
    return { text: `Due ${formatDueShort(task.dueDate)}`, tone: "later" };
  }
  if (n < 0) {
    return {
      text: `${-n} ${n === -1 ? "day" : "days"} overdue`,
      tone: "overdue",
    };
  }
  if (n === 0) return { text: "Due today", tone: "today" };
  if (n === 1) return { text: "Due tomorrow", tone: "soon" };
  if (n < 7) {
    return {
      text: `Due ${format(task.dueDate, { weekday: "short" })}`,
      tone: "soon",
    };
  }
  return { text: `Due ${formatDueShort(task.dueDate)}`, tone: "later" };
}

/** Open and due today or in the next six days. */
export function isDueThisWeek(
  task: Pick<BoardTaskFields, "status" | "dueDate">,
  today: string,
): boolean {
  if (task.status === DONE) return false;
  const n = daysFrom(today, task.dueDate);
  return n >= 0 && n < 7;
}

/**
 * Board order: open before Done, then soonest due, so overdue tasks come
 * first. Ties keep the order they were added in.
 */
export function compareTasks(a: BoardTaskFields, b: BoardTaskFields): number {
  return (
    Number(a.status === DONE) - Number(b.status === DONE) ||
    a.dueDate.localeCompare(b.dueDate) ||
    a.id - b.id
  );
}

export type BoardSummary = {
  open: number;
  overdue: number;
  dueThisWeek: number;
  needsNewOwner: number;
};

/** The counts under the page title. Always the whole board, not the filters. */
export function summarize(
  tasks: readonly BoardTaskFields[],
  today: string,
): BoardSummary {
  const open = tasks.filter((t) => t.status !== DONE);
  return {
    open: open.length,
    overdue: open.filter((t) => t.isOverdue).length,
    dueThisWeek: open.filter((t) => isDueThisWeek(t, today)).length,
    needsNewOwner: open.filter((t) => t.needsNewOwner).length,
  };
}

export type BoardFilters = {
  groupBy: "owner" | "team";
  /** Only tasks the viewer owns. */
  mine: boolean;
  showDone: boolean;
};

export type BoardGroup<T> =
  | { kind: "needsOwner"; key: string; tasks: T[] }
  | { kind: "owner"; key: string; ownerId: number; tasks: T[] }
  | { kind: "team"; key: string; teamId: number | null; tasks: T[] };

/**
 * The groups the board shows, in order.
 *
 * By owner: "Needs a new owner" first when it has anything, then one group
 * per e-board member in `ownerIds` order, kept even when empty so the
 * president sees who has nothing. An owner missing from `ownerIds` who still
 * has tasks gets a group at the end, so no task is ever hidden.
 *
 * By team: one group per team in `teamIds` order that has tasks, then "No
 * team".
 */
export function groupTasks<T extends BoardTaskFields>(
  tasks: readonly T[],
  {
    filters,
    viewerId,
    ownerIds,
    teamIds,
  }: {
    filters: BoardFilters;
    viewerId: number;
    ownerIds: readonly number[];
    teamIds: readonly number[];
  },
): BoardGroup<T>[] {
  const shown = tasks
    .filter((t) => filters.showDone || t.status !== DONE)
    .filter((t) => !filters.mine || t.ownerId === viewerId)
    .slice()
    .sort(compareTasks);

  if (filters.groupBy === "team") {
    const groups: BoardGroup<T>[] = [];
    for (const teamId of [...teamIds, null]) {
      const mine = shown.filter((t) => t.teamId === teamId);
      if (mine.length)
        groups.push({
          kind: "team",
          key: `team-${teamId}`,
          teamId,
          tasks: mine,
        });
    }
    // A label for a team that has since been archived still shows.
    const known = new Set<number | null>([...teamIds, null]);
    const strays = [...new Set(shown.map((t) => t.teamId))].filter(
      (id) => !known.has(id),
    );
    for (const teamId of strays) {
      groups.push({
        kind: "team",
        key: `team-${teamId}`,
        teamId,
        tasks: shown.filter((t) => t.teamId === teamId),
      });
    }
    return groups;
  }

  const groups: BoardGroup<T>[] = [];
  const orphans = shown.filter((t) => t.needsNewOwner);
  if (orphans.length)
    groups.push({ kind: "needsOwner", key: "needs-owner", tasks: orphans });

  const owned = shown.filter((t) => !t.needsNewOwner);
  const people = filters.mine ? [viewerId] : [...ownerIds];
  for (const id of new Set(owned.map((t) => t.ownerId))) {
    if (!people.includes(id)) people.push(id);
  }
  for (const ownerId of people) {
    groups.push({
      kind: "owner",
      key: `owner-${ownerId}`,
      ownerId,
      tasks: owned.filter((t) => t.ownerId === ownerId),
    });
  }
  return groups;
}
