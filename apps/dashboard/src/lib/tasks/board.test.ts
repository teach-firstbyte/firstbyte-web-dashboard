import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addDays,
  daysFrom,
  dueLabel,
  groupTasks,
  isDueThisWeek,
  summarize,
  type BoardFilters,
  type BoardTaskFields,
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
