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

// ---------------------------------------------------------------------------
// The kanban view (#144): To do, In progress and Done columns.

/** Board (the columns) or List (the groups). Board is the default. */
export type BoardView = "board" | "list";

/** Who the columns show. Null means everyone, or every team. */
export type KanbanFilters = {
  /** Only tasks the viewer owns. Wins over `ownerId`. */
  mine: boolean;
  ownerId: number | "needsOwner" | null;
  teamId: number | "none" | null;
};

/** Everything the page keeps in the URL: the view, and each view's filters. */
export type BoardSettings = BoardFilters &
  Omit<KanbanFilters, "mine"> & { view: BoardView };

/** The columns, left to right, by status value. */
export const KANBAN_COLUMNS = ["TODO", "IN_PROGRESS", DONE] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

/** How many Done cards show before "Show all". */
export const DONE_SHOWN = 5;

/** The fields the columns read: the board's, plus when it last changed. */
export type KanbanTaskFields = BoardTaskFields & { updatedAt: Date | string };

/** Whether any filter is narrowing the columns. */
export function isKanbanFiltered(f: KanbanFilters): boolean {
  return f.mine || f.ownerId !== null || f.teamId !== null;
}

/** The tasks the filters let through, in no particular order. */
export function filterKanban<T extends BoardTaskFields>(
  tasks: readonly T[],
  filters: KanbanFilters,
  viewerId: number,
): T[] {
  return tasks.filter((t) => {
    if (filters.mine) {
      if (t.ownerId !== viewerId) return false;
    } else if (filters.ownerId === "needsOwner") {
      if (!t.needsNewOwner) return false;
    } else if (filters.ownerId !== null && t.ownerId !== filters.ownerId) {
      return false;
    }
    if (filters.teamId === "none") return t.teamId === null;
    if (filters.teamId !== null) return t.teamId === filters.teamId;
    return true;
  });
}

function changedAt(t: KanbanTaskFields): number {
  return new Date(t.updatedAt).getTime();
}

/**
 * The three columns. To do and In progress go soonest due first, so overdue
 * tasks lead. Done goes most recently changed first: the task has no
 * "finished on" date, and marking it done is almost always its last change.
 * A status this board doesn't know lands in To do, so no task is hidden.
 */
export function kanbanColumns<T extends KanbanTaskFields>(
  tasks: readonly T[],
  filters: KanbanFilters,
  viewerId: number,
): Record<KanbanColumn, T[]> {
  const columns: Record<KanbanColumn, T[]> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };
  for (const t of filterKanban(tasks, filters, viewerId)) {
    const key = (KANBAN_COLUMNS as readonly string[]).includes(t.status)
      ? (t.status as KanbanColumn)
      : "TODO";
    columns[key].push(t);
  }
  columns.TODO.sort(compareTasks);
  columns.IN_PROGRESS.sort(compareTasks);
  columns.DONE.sort((a, b) => changedAt(b) - changedAt(a) || b.id - a.id);
  return columns;
}

/** The URL value for a person filter: an id, or "needs-owner". */
export function ownerFilterParam(id: KanbanFilters["ownerId"]): string | null {
  if (id === null) return null;
  return id === "needsOwner" ? "needs-owner" : String(id);
}

/** Reads a person filter back from the URL. Anything else means everyone. */
export function parseOwnerFilter(
  raw: string | undefined,
): KanbanFilters["ownerId"] {
  if (raw === "needs-owner") return "needsOwner";
  return positiveInt(raw);
}

/** Reads a team filter back from the URL: an id, or "none". */
export function parseTeamFilter(
  raw: string | undefined,
): KanbanFilters["teamId"] {
  if (raw === "none") return "none";
  return positiveInt(raw);
}

function positiveInt(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// The URL

/**
 * Whether "Only mine" is on when the URL doesn't say.
 *
 * Regular e-board members start on their own tasks, super admins (the
 * president, VP and website lead) on everyone's. A Board link that already
 * picks a person or a team starts with it off for everyone, so it shows what
 * it points at. This only decides what the board shows first: every e-board
 * member can still read every task.
 */
export function defaultMine(
  superAdmin: boolean,
  f: Pick<BoardSettings, "view" | "ownerId" | "teamId">,
): boolean {
  if (superAdmin) return false;
  const picksSomeone =
    f.view === "board" && (f.ownerId !== null || f.teamId !== null);
  return !picksSomeone;
}

/** Reads one URL query value, the first if there are several. */
export type BoardQuery = (key: string) => string | undefined;

/**
 * The board's settings from the URL. `mine=1` is on, `mine=0` is off, and no
 * `mine` (or anything else) is this person's default, from defaultMine.
 */
export function parseBoardSettings(
  get: BoardQuery,
  superAdmin: boolean,
): BoardSettings {
  const view: BoardView = get("view") === "list" ? "list" : "board";
  const ownerId = parseOwnerFilter(get("person"));
  const teamId = parseTeamFilter(get("team"));
  const mine = get("mine");
  return {
    view,
    groupBy: get("group") === "team" ? "team" : "owner",
    mine:
      mine === "1"
        ? true
        : mine === "0"
          ? false
          : defaultMine(superAdmin, { view, ownerId, teamId }),
    showDone: get("done") === "1",
    ownerId,
    teamId,
  };
}

/**
 * The URL query for the board's settings, so a reload or a shared link keeps
 * them. Only what differs from the defaults is written: Board is the default
 * view, the person and team filters belong to it, and the grouping and "Show
 * done" to List. "Only mine" is written (`mine=1` or `mine=0`) only when it
 * differs from this person's default, so parseBoardSettings reads the same
 * settings back.
 */
export function filtersToQuery(f: BoardSettings, superAdmin: boolean): string {
  const q = new URLSearchParams();
  let ownerId: KanbanFilters["ownerId"] = null;
  let teamId: KanbanFilters["teamId"] = null;
  if (f.view === "list") {
    q.set("view", "list");
    if (f.groupBy === "team") q.set("group", "team");
    if (f.showDone) q.set("done", "1");
  } else {
    const person = ownerFilterParam(f.ownerId);
    if (person) q.set("person", person);
    if (f.teamId !== null) q.set("team", String(f.teamId));
    ownerId = f.ownerId;
    teamId = f.teamId;
  }
  if (f.mine !== defaultMine(superAdmin, { view: f.view, ownerId, teamId })) {
    q.set("mine", f.mine ? "1" : "0");
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * The query for a link to one person's tasks on the Board: "?person=8". It
 * opens with "Only mine" off for anyone (defaultMine), so a DM to someone
 * about a task they don't own, like the overdue note to its creator, lands
 * where they can see it.
 */
export function personBoardQuery(ownerId: number): string {
  return `?person=${encodeURIComponent(String(ownerId))}`;
}
