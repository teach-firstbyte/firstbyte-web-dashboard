import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addDays,
  daysFrom,
  defaultMine,
  dueLabel,
  filterKanban,
  filtersToQuery,
  groupTasks,
  isDueThisWeek,
  isKanbanFiltered,
  kanbanColumns,
  ownerFilterParam,
  parseBoardSettings,
  parseOwnerFilter,
  parseTeamFilter,
  summarize,
  type BoardFilters,
  type BoardSettings,
  type BoardTaskFields,
  type KanbanFilters,
} from "./board.ts";

// A Wednesday.
const TODAY = "2026-11-18";

let nextId = 1;
function task(over: Partial<BoardTaskFields> = {}): BoardTaskFields {
  const dueDate = over.dueDate ?? TODAY;
  const status = over.status ?? "TODO";
  return {
    id: nextId++,
    status,
    dueDate,
    ownerId: 1,
    teamId: null,
    isOverdue: status !== "DONE" && dueDate < TODAY,
    needsNewOwner: false,
    ...over,
  };
}

const BY_OWNER: BoardFilters = {
  groupBy: "owner",
  mine: false,
  showDone: false,
};

test("counts days across a month end", () => {
  assert.equal(daysFrom("2026-11-30", "2026-12-01"), 1);
  assert.equal(daysFrom(TODAY, "2026-11-15"), -3);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("words the due column like the mockup", () => {
  const at = (n: number, status = "TODO") =>
    dueLabel({ status, dueDate: addDays(TODAY, n) }, TODAY);
  assert.deepEqual(at(-1), { text: "1 day overdue", tone: "overdue" });
  assert.deepEqual(at(-3), { text: "3 days overdue", tone: "overdue" });
  assert.deepEqual(at(0), { text: "Due today", tone: "today" });
  assert.deepEqual(at(1), { text: "Due tomorrow", tone: "soon" });
  assert.deepEqual(at(2), { text: "Due Fri", tone: "soon" });
  assert.deepEqual(at(12), { text: "Due Nov 30", tone: "later" });
  // Done never reads as overdue.
  assert.deepEqual(at(-3, "DONE"), { text: "Due Nov 15", tone: "later" });
});

test("this week is today through six days out, open only", () => {
  assert.equal(isDueThisWeek({ status: "TODO", dueDate: TODAY }, TODAY), true);
  assert.equal(
    isDueThisWeek({ status: "TODO", dueDate: addDays(TODAY, 6) }, TODAY),
    true,
  );
  assert.equal(
    isDueThisWeek({ status: "TODO", dueDate: addDays(TODAY, 7) }, TODAY),
    false,
  );
  assert.equal(
    isDueThisWeek({ status: "TODO", dueDate: addDays(TODAY, -1) }, TODAY),
    false,
  );
  assert.equal(isDueThisWeek({ status: "DONE", dueDate: TODAY }, TODAY), false);
});

test("summary counts open work only", () => {
  const s = summarize(
    [
      task({ dueDate: addDays(TODAY, -2) }),
      task({ dueDate: addDays(TODAY, 3) }),
      task({ dueDate: addDays(TODAY, 20), needsNewOwner: true }),
      task({
        dueDate: addDays(TODAY, -5),
        status: "DONE",
        needsNewOwner: true,
      }),
    ],
    TODAY,
  );
  assert.deepEqual(s, {
    open: 3,
    overdue: 1,
    dueThisWeek: 1,
    needsNewOwner: 1,
  });
});

test("by owner: needs-a-new-owner first, everyone listed, overdue first", () => {
  const later = task({ ownerId: 2, dueDate: addDays(TODAY, 9) });
  const overdue = task({ ownerId: 2, dueDate: addDays(TODAY, -1) });
  const orphan = task({ ownerId: 9, needsNewOwner: true });
  const done = task({ ownerId: 2, status: "DONE" });

  const groups = groupTasks([later, overdue, orphan, done], {
    filters: BY_OWNER,
    viewerId: 1,
    ownerIds: [1, 2],
    teamIds: [],
  });

  assert.deepEqual(
    groups.map((g) => [g.key, g.tasks.map((t) => t.id)]),
    [
      ["needs-owner", [orphan.id]],
      ["owner-1", []],
      ["owner-2", [overdue.id, later.id]],
    ],
  );
});

test("show done puts Done last in its group", () => {
  const done = task({
    ownerId: 2,
    status: "DONE",
    dueDate: addDays(TODAY, -9),
  });
  const open = task({ ownerId: 2, dueDate: addDays(TODAY, 4) });
  const [group] = groupTasks([done, open], {
    filters: { ...BY_OWNER, showDone: true },
    viewerId: 1,
    ownerIds: [2],
    teamIds: [],
  });
  assert.deepEqual(
    group.tasks.map((t) => t.id),
    [open.id, done.id],
  );
});

test("mine keeps only the viewer's group, even if they own nothing", () => {
  const theirs = task({ ownerId: 2 });
  const orphan = task({ ownerId: 9, needsNewOwner: true });
  const groups = groupTasks([theirs, orphan], {
    filters: { ...BY_OWNER, mine: true },
    viewerId: 1,
    ownerIds: [1, 2],
    teamIds: [],
  });
  assert.deepEqual(
    groups.map((g) => [g.key, g.tasks.length]),
    [["owner-1", 0]],
  );
});

test("an owner who isn't in the list still gets a group", () => {
  const t = task({ ownerId: 7 });
  const groups = groupTasks([t], {
    filters: BY_OWNER,
    viewerId: 1,
    ownerIds: [1],
    teamIds: [],
  });
  assert.deepEqual(
    groups.map((g) => g.key),
    ["owner-1", "owner-7"],
  );
});

test("by team: teams in order, empty ones dropped, no team last", () => {
  const events = task({ teamId: 20 });
  const none = task({ teamId: null });
  const archived = task({ teamId: 99 });
  const groups = groupTasks([none, events, archived], {
    filters: { ...BY_OWNER, groupBy: "team" },
    viewerId: 1,
    ownerIds: [],
    teamIds: [10, 20],
  });
  assert.deepEqual(
    groups.map((g) => g.key),
    ["team-20", "team-null", "team-99"],
  );
});

// --- Kanban (#144) ---------------------------------------------------------

type KTask = BoardTaskFields & { updatedAt: string };
function ktask(over: Partial<KTask> = {}): KTask {
  return { ...task(over), updatedAt: "2026-11-18T12:00:00Z", ...over };
}
const EVERYONE: KanbanFilters = { mine: false, ownerId: null, teamId: null };
const titles = (ts: { id: number }[]) => ts.map((t) => t.id);

test("kanban: open columns soonest due first, Done most recent first", () => {
  const late = ktask({ dueDate: "2026-11-15" });
  const soon = ktask({ dueDate: "2026-11-20" });
  const doing = ktask({ status: "IN_PROGRESS", dueDate: "2026-11-19" });
  const oldDone = ktask({ status: "DONE", updatedAt: "2026-11-01T10:00:00Z" });
  const newDone = ktask({ status: "DONE", updatedAt: "2026-11-17T10:00:00Z" });
  const cols = kanbanColumns(
    [soon, oldDone, doing, late, newDone],
    EVERYONE,
    1,
  );
  assert.deepEqual(titles(cols.TODO), [late.id, soon.id]);
  assert.deepEqual(titles(cols.IN_PROGRESS), [doing.id]);
  assert.deepEqual(titles(cols.DONE), [newDone.id, oldDone.id]);
});

test("kanban: Done orders by updatedAt given as Date objects too", () => {
  const a = { ...ktask({ status: "DONE" }), updatedAt: new Date("2026-11-02") };
  const b = { ...ktask({ status: "DONE" }), updatedAt: new Date("2026-11-09") };
  assert.deepEqual(titles(kanbanColumns([a, b], EVERYONE, 1).DONE), [
    b.id,
    a.id,
  ]);
});

test("kanban: an unknown status lands in To do", () => {
  const odd = ktask({ status: "BLOCKED" });
  assert.deepEqual(titles(kanbanColumns([odd], EVERYONE, 1).TODO), [odd.id]);
});

test("kanban: filters by person, needs-a-new-owner, team and no team", () => {
  const mine = ktask({ ownerId: 7, teamId: 3 });
  const theirs = ktask({ ownerId: 8, teamId: null });
  const orphan = ktask({ ownerId: 9, teamId: 3, needsNewOwner: true });
  const all = [mine, theirs, orphan];
  const ids = (f: Partial<KanbanFilters>) =>
    titles(filterKanban(all, { ...EVERYONE, ...f }, 7));
  assert.deepEqual(ids({}), [mine.id, theirs.id, orphan.id]);
  assert.deepEqual(ids({ ownerId: 8 }), [theirs.id]);
  assert.deepEqual(ids({ ownerId: "needsOwner" }), [orphan.id]);
  assert.deepEqual(ids({ teamId: 3 }), [mine.id, orphan.id]);
  assert.deepEqual(ids({ teamId: "none" }), [theirs.id]);
  // Only mine wins over a person filter, and still respects the team.
  assert.deepEqual(ids({ mine: true, ownerId: 8 }), [mine.id]);
  assert.deepEqual(ids({ mine: true, teamId: "none" }), []);
  assert.equal(isKanbanFiltered(EVERYONE), false);
  assert.equal(isKanbanFiltered({ ...EVERYONE, teamId: "none" }), true);
});

test("kanban: person and team filters round-trip through the URL", () => {
  assert.equal(ownerFilterParam(null), null);
  assert.equal(ownerFilterParam("needsOwner"), "needs-owner");
  assert.equal(parseOwnerFilter(ownerFilterParam(12) ?? undefined), 12);
  assert.equal(parseOwnerFilter("needs-owner"), "needsOwner");
  assert.equal(parseTeamFilter("none"), "none");
  assert.equal(parseTeamFilter("4"), 4);
  for (const bad of [undefined, "", "0", "-3", "1.5", "abc", "1e3"]) {
    assert.equal(parseOwnerFilter(bad), null);
    assert.equal(parseTeamFilter(bad), null);
  }
});

// ---------------------------------------------------------------------------
// "Only mine" by default, and the URL

const MEMBER = false;
const SUPER_ADMIN = true;

/** The page's parse of a query string. */
function parse(query: string, superAdmin: boolean): BoardSettings {
  const params = new URLSearchParams(query);
  return parseBoardSettings((k) => params.get(k) ?? undefined, superAdmin);
}

const BOARD: BoardSettings = {
  view: "board",
  groupBy: "owner",
  mine: false,
  showDone: false,
  ownerId: null,
  teamId: null,
};

test("only mine: on by default for members, off for super admins", () => {
  assert.equal(parse("", MEMBER).mine, true);
  assert.equal(parse("view=list", MEMBER).mine, true);
  assert.equal(parse("", SUPER_ADMIN).mine, false);
  assert.equal(parse("view=list", SUPER_ADMIN).mine, false);
});

test("only mine: mine=1 and mine=0 say it either way, for anyone", () => {
  for (const who of [MEMBER, SUPER_ADMIN]) {
    assert.equal(parse("mine=1", who).mine, true);
    assert.equal(parse("mine=0", who).mine, false);
    assert.equal(parse("view=list&mine=0", who).mine, false);
    assert.equal(parse("view=list&mine=1", who).mine, true);
    // Anything else is the default.
    assert.equal(parse("mine=yes", who).mine, !who);
  }
});

test("only mine: a link to a person or team shows them, for members too", () => {
  assert.equal(parse("person=8", MEMBER).mine, false);
  assert.equal(parse("person=needs-owner", MEMBER).mine, false);
  assert.equal(parse("team=3", MEMBER).mine, false);
  assert.equal(parse("team=none", MEMBER).mine, false);
  assert.equal(parse("team=3&mine=1", MEMBER).mine, true);
  // List has no person or team filter, so they don't change its default.
  assert.equal(parse("view=list&person=8", MEMBER).mine, true);
  // A junk person is no person.
  assert.equal(parse("person=abc", MEMBER).mine, true);
  assert.equal(defaultMine(MEMBER, BOARD), true);
  assert.equal(defaultMine(MEMBER, { ...BOARD, ownerId: 8 }), false);
  assert.equal(defaultMine(SUPER_ADMIN, BOARD), false);
});

test("the URL writes only what differs from this person's default", () => {
  // Each person's default writes nothing, so /tasks stays /tasks.
  assert.equal(filtersToQuery({ ...BOARD, mine: true }, MEMBER), "");
  assert.equal(filtersToQuery(BOARD, SUPER_ADMIN), "");
  // Turned off by a member, or on by a super admin.
  assert.equal(filtersToQuery(BOARD, MEMBER), "?mine=0");
  assert.equal(
    filtersToQuery({ ...BOARD, mine: true }, SUPER_ADMIN),
    "?mine=1",
  );
  // A person or team: off is the default, on is written.
  assert.equal(filtersToQuery({ ...BOARD, ownerId: 8 }, MEMBER), "?person=8");
  assert.equal(
    filtersToQuery({ ...BOARD, teamId: 3, mine: true }, MEMBER),
    "?team=3&mine=1",
  );
  // List ignores the board's person filter, and its default is the role's.
  const list: BoardSettings = { ...BOARD, view: "list", ownerId: 8 };
  assert.equal(filtersToQuery(list, MEMBER), "?view=list&mine=0");
  assert.equal(filtersToQuery({ ...list, mine: true }, MEMBER), "?view=list");
  assert.equal(
    filtersToQuery({ ...list, groupBy: "team", showDone: true }, SUPER_ADMIN),
    "?view=list&group=team&done=1",
  );
});

test("settings survive a round trip through the URL, for both roles", () => {
  const cases: BoardSettings[] = [];
  for (const mine of [true, false]) {
    for (const ownerId of [null, 8, "needsOwner"] as const) {
      for (const teamId of [null, 3, "none"] as const) {
        cases.push({ ...BOARD, mine, ownerId, teamId });
      }
    }
    for (const groupBy of ["owner", "team"] as const) {
      for (const showDone of [true, false]) {
        cases.push({ ...BOARD, view: "list", mine, groupBy, showDone });
      }
    }
  }
  for (const who of [MEMBER, SUPER_ADMIN]) {
    for (const settings of cases) {
      const query = filtersToQuery(settings, who);
      assert.deepEqual(parse(query.slice(1), who), settings, query);
    }
  }
});

test("the old ?mine=1 links still mean on", () => {
  assert.equal(parse("mine=1", MEMBER).mine, true);
  assert.equal(parse("mine=1", SUPER_ADMIN).mine, true);
});
