import assert from "node:assert/strict";
import { test } from "node:test";

import { addDays, type BoardTaskFields } from "./board.ts";
import { selectMyTasks } from "./home.ts";

// A Saturday.
const TODAY = "2026-11-21";
const ME = 7;

let nextId = 1;
function task(
  due: number,
  over: Partial<BoardTaskFields> = {},
): BoardTaskFields {
  const dueDate = addDays(TODAY, due);
  const status = over.status ?? "TODO";
  return {
    id: nextId++,
    status,
    dueDate,
    ownerId: ME,
    teamId: null,
    isOverdue: status !== "DONE" && due < 0,
    needsNewOwner: false,
    ...over,
  };
}

const ids = (ts: readonly BoardTaskFields[]) => ts.map((t) => t.id);

test("keeps overdue and the next seven days, soonest first", () => {
  const nextWeek = task(6);
  const today = task(0);
  const late = task(-3);
  const tomorrow = task(1, { status: "IN_PROGRESS" });
  const pick = selectMyTasks([nextWeek, today, late, tomorrow], ME, TODAY);
  assert.deepEqual(ids(pick.due), ids([late, today, tomorrow, nextWeek]));
  assert.equal(pick.overdue, 1);
  assert.equal(pick.later, 0);
});

test("counts what is due after the week as later", () => {
  const soon = task(2);
  const pick = selectMyTasks([task(7), soon, task(30)], ME, TODAY);
  assert.deepEqual(ids(pick.due), ids([soon]));
  assert.equal(pick.overdue, 0);
  assert.equal(pick.later, 2);
});

test("only due this week: no overdue count", () => {
  const pick = selectMyTasks([task(0), task(3)], ME, TODAY);
  assert.equal(pick.due.length, 2);
  assert.equal(pick.overdue, 0);
});

test("leaves out Done tasks, even overdue ones", () => {
  const pick = selectMyTasks(
    [task(-2, { status: "DONE" }), task(2, { status: "DONE" })],
    ME,
    TODAY,
  );
  assert.deepEqual(pick, { due: [], overdue: 0, later: 0 });
});

test("leaves out other people's tasks", () => {
  const mine = task(-1);
  const pick = selectMyTasks(
    [task(-1, { ownerId: 8 }), mine, task(20, { ownerId: 8 })],
    ME,
    TODAY,
  );
  assert.deepEqual(ids(pick.due), ids([mine]));
  assert.equal(pick.overdue, 1);
  assert.equal(pick.later, 0);
});

test("nothing at all", () => {
  assert.deepEqual(selectMyTasks([], ME, TODAY), {
    due: [],
    overdue: 0,
    later: 0,
  });
});

test("goes by the dates, not a stale isOverdue flag", () => {
  // Loaded just before midnight, compared just after.
  const yesterday = task(-1, { isOverdue: false });
  const pick = selectMyTasks([yesterday], ME, TODAY);
  assert.deepEqual(ids(pick.due), ids([yesterday]));
  assert.equal(pick.overdue, 1);
});

test("crosses a month end", () => {
  const pick = selectMyTasks(
    [task(0, { dueDate: "2026-12-04" }), task(0, { dueDate: "2026-12-05" })],
    ME,
    "2026-11-28",
  );
  assert.equal(pick.due.length, 1);
  assert.equal(pick.later, 1);
});

test("doesn't reorder the caller's array", () => {
  const input = [task(3), task(-1)];
  const before = ids(input);
  selectMyTasks(input, ME, TODAY);
  assert.deepEqual(ids(input), before);
});
