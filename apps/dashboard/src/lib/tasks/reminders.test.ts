import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  addDays,
  afterFailedSend,
  bostonClock,
  dueDateWindow,
  eventRemindersFor,
  isReminderUndelivered,
  reminderStillWanted,
  scheduledRemindersDue,
  type CurrentTask,
  type ReminderTask,
  type TaskSnapshot,
} from "./reminders.ts";

// 2026: daylight saving starts Sunday March 8 and ends Sunday November 1.
// 9am Boston is 13:00 UTC in summer (EDT) and 14:00 UTC in winter (EST).

const OWNER = 1;
const CREATOR = 2;
const SOMEONE = 3;

function task(overrides: Partial<ReminderTask> = {}): ReminderTask {
  return {
    status: "TODO",
    dueDate: "2026-11-20",
    ownerId: OWNER,
    createdById: CREATOR,
    needsNewOwner: false,
    remindersFrom: new Date("2026-11-10T15:00:00Z"),
    ...overrides,
  };
}

const at = (iso: string) => new Date(iso);
const kinds = (t: ReminderTask, now: string) =>
  scheduledRemindersDue(t, at(now)).map((r) => `${r.kind}->${r.recipientId}`);

describe("bostonClock", () => {
  test("reads the day and hour in Boston, not UTC", () => {
    assert.deepEqual(bostonClock(at("2026-11-20T14:00:00Z")), {
      date: "2026-11-20",
      hour: 9,
    });
    assert.deepEqual(bostonClock(at("2026-07-10T13:00:00Z")), {
      date: "2026-07-10",
      hour: 9,
    });
  });

  test("late evening in Boston is already tomorrow in UTC", () => {
    assert.deepEqual(bostonClock(at("2026-11-21T03:30:00Z")), {
      date: "2026-11-20",
      hour: 22,
    });
  });

  test("midnight is hour 0, not 24", () => {
    assert.equal(bostonClock(at("2026-11-21T05:00:00Z")).hour, 0);
  });
});

describe("addDays", () => {
  test("crosses months, years and DST changes by the calendar", () => {
    assert.equal(addDays("2026-11-30", 1), "2026-12-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -2), "2026-02-27");
    assert.equal(addDays("2026-03-07", 1), "2026-03-08");
    assert.equal(addDays("2026-11-01", -1), "2026-10-31");
  });
});

describe("scheduledRemindersDue: the schedule", () => {
  test("2 days before, from 9am Boston", () => {
    assert.deepEqual(kinds(task(), "2026-11-18T13:59:00Z"), []);
    assert.deepEqual(kinds(task(), "2026-11-18T14:00:00Z"), ["DUE_SOON->1"]);
    assert.deepEqual(kinds(task(), "2026-11-18T20:00:00Z"), ["DUE_SOON->1"]);
  });

  test("nothing the day before the due date", () => {
    assert.deepEqual(kinds(task(), "2026-11-19T15:00:00Z"), []);
  });

  test("on the due date, from 9am Boston, until Boston midnight", () => {
    assert.deepEqual(kinds(task(), "2026-11-20T13:00:00Z"), []);
    assert.deepEqual(kinds(task(), "2026-11-20T14:00:00Z"), ["DUE_TODAY->1"]);
    // 11:30pm on the 20th in Boston, the 21st in UTC.
    assert.deepEqual(kinds(task(), "2026-11-21T04:30:00Z"), ["DUE_TODAY->1"]);
    // Midnight in Boston: the 21st, before 9am.
    assert.deepEqual(kinds(task(), "2026-11-21T05:00:00Z"), []);
  });

  test("1 day overdue goes to the owner and the creator", () => {
    assert.deepEqual(kinds(task(), "2026-11-21T14:00:00Z"), [
      "OVERDUE_OWNER->1",
      "OVERDUE_CREATOR->2",
    ]);
  });

  test("the creator isn't told twice when they're the owner", () => {
    const own = task({ createdById: OWNER });
    assert.deepEqual(kinds(own, "2026-11-21T14:00:00Z"), ["OVERDUE_OWNER->1"]);
  });

  test("no daily overdue reminders after that", () => {
    assert.deepEqual(kinds(task(), "2026-11-22T14:00:00Z"), []);
    assert.deepEqual(kinds(task(), "2026-12-01T14:00:00Z"), []);
  });

  test("each reminder carries the due date it's about", () => {
    const [r] = scheduledRemindersDue(task(), at("2026-11-18T14:00:00Z"));
    assert.deepEqual(r, {
      kind: "DUE_SOON",
      recipientId: OWNER,
      dueDate: "2026-11-20",
    });
  });
});

describe("scheduledRemindersDue: daylight saving", () => {
  test("spring forward: 9am EDT is 13:00 UTC", () => {
    // Due Tuesday March 10; the 2-day reminder is Sunday March 8, the day the
    // clocks change at 2am.
    const t = task({
      dueDate: "2026-03-10",
      remindersFrom: at("2026-03-01T15:00:00Z"),
    });
    assert.deepEqual(kinds(t, "2026-03-08T12:59:00Z"), []);
    assert.deepEqual(kinds(t, "2026-03-08T13:00:00Z"), ["DUE_SOON->1"]);
  });

  test("fall back: 9am EST is 14:00 UTC", () => {
    // Due Tuesday November 3; the 2-day reminder is Sunday November 1.
    const t = task({
      dueDate: "2026-11-03",
      remindersFrom: at("2026-10-20T15:00:00Z"),
    });
    // 13:30 UTC would be 9:30 in summer time, but it's 8:30 now.
    assert.deepEqual(kinds(t, "2026-11-01T13:30:00Z"), []);
    assert.deepEqual(kinds(t, "2026-11-01T14:00:00Z"), ["DUE_SOON->1"]);
  });

  test("a summer due date", () => {
    const t = task({
      dueDate: "2026-07-15",
      remindersFrom: at("2026-07-01T15:00:00Z"),
    });
    assert.deepEqual(kinds(t, "2026-07-15T12:30:00Z"), []);
    assert.deepEqual(kinds(t, "2026-07-15T13:00:00Z"), ["DUE_TODAY->1"]);
  });
});

describe("scheduledRemindersDue: when nothing is sent", () => {
  test("a Done task", () => {
    const done = task({ status: "DONE" });
    for (const now of [
      "2026-11-18T14:00:00Z",
      "2026-11-20T14:00:00Z",
      "2026-11-21T14:00:00Z",
    ]) {
      assert.deepEqual(kinds(done, now), []);
    }
  });

  test("In progress is still reminded", () => {
    const t = task({ status: "IN_PROGRESS" });
    assert.deepEqual(kinds(t, "2026-11-20T14:00:00Z"), ["DUE_TODAY->1"]);
  });

  test("a task that needs a new owner, creator included", () => {
    const orphan = task({ needsNewOwner: true });
    assert.deepEqual(kinds(orphan, "2026-11-20T14:00:00Z"), []);
    assert.deepEqual(kinds(orphan, "2026-11-21T14:00:00Z"), []);
  });

  test("created due today: only the assigned DM, never a reminder", () => {
    // Created at 8am Boston, before the 9am reminder.
    const t = task({ remindersFrom: at("2026-11-20T13:00:00Z") });
    assert.deepEqual(kinds(t, "2026-11-20T14:00:00Z"), []);
    assert.deepEqual(kinds(t, "2026-11-21T14:00:00Z"), []);
  });

  test("created already overdue: nothing", () => {
    const t = task({
      dueDate: "2026-11-15",
      remindersFrom: at("2026-11-20T15:00:00Z"),
    });
    assert.deepEqual(kinds(t, "2026-11-20T15:00:00Z"), []);
    assert.deepEqual(kinds(t, "2026-11-21T14:00:00Z"), []);
  });

  test("created the day the 2-day reminder falls: it waits for the due date", () => {
    // Created at 8am, an hour before that reminder would go out. The assigned
    // DM just told them.
    const t = task({ remindersFrom: at("2026-11-18T13:00:00Z") });
    assert.deepEqual(kinds(t, "2026-11-18T14:00:00Z"), []);
    assert.deepEqual(kinds(t, "2026-11-20T14:00:00Z"), ["DUE_TODAY->1"]);
  });

  test("created due tomorrow: due today and overdue still come", () => {
    const t = task({ remindersFrom: at("2026-11-19T20:00:00Z") });
    assert.deepEqual(kinds(t, "2026-11-20T14:00:00Z"), ["DUE_TODAY->1"]);
    assert.deepEqual(kinds(t, "2026-11-21T14:00:00Z"), [
      "OVERDUE_OWNER->1",
      "OVERDUE_CREATOR->2",
    ]);
  });

  test("created at 11pm the night before (the next day in UTC)", () => {
    // 11pm on the 17th in Boston is 04:00 UTC on the 18th. The 2-day reminder
    // on the 18th still goes: the schedule started on the 17th.
    const t = task({ remindersFrom: at("2026-11-18T04:00:00Z") });
    assert.deepEqual(kinds(t, "2026-11-18T14:00:00Z"), ["DUE_SOON->1"]);
  });

  test("a reminder day with no run at all is dropped, not sent late", () => {
    // The 2-day reminder was the 18th. A run on the 19th sends nothing.
    assert.deepEqual(kinds(task(), "2026-11-19T14:00:00Z"), []);
  });
});

describe("scheduledRemindersDue: a changed due date restarts the schedule", () => {
  test("moved later: the old date's reminders stop, the new ones run", () => {
    // Was due the 20th; on the 19th it moved to the 25th.
    const moved = task({
      dueDate: "2026-11-25",
      remindersFrom: at("2026-11-19T16:00:00Z"),
    });
    assert.deepEqual(kinds(moved, "2026-11-20T14:00:00Z"), []);
    assert.deepEqual(kinds(moved, "2026-11-21T14:00:00Z"), []);
    const [soon] = scheduledRemindersDue(moved, at("2026-11-23T14:00:00Z"));
    assert.deepEqual(soon, {
      kind: "DUE_SOON",
      recipientId: OWNER,
      dueDate: "2026-11-25",
    });
  });

  test("moved to today: just the date-changed DM", () => {
    const moved = task({ remindersFrom: at("2026-11-20T15:00:00Z") });
    assert.deepEqual(kinds(moved, "2026-11-20T16:00:00Z"), []);
    assert.deepEqual(kinds(moved, "2026-11-21T14:00:00Z"), []);
  });

  test("reassigned the day before: the new owner gets the due-today one", () => {
    const t = task({
      ownerId: SOMEONE,
      remindersFrom: at("2026-11-19T18:00:00Z"),
    });
    assert.deepEqual(kinds(t, "2026-11-20T14:00:00Z"), ["DUE_TODAY->3"]);
  });
});

describe("dueDateWindow", () => {
  test("yesterday to the day after tomorrow, in Boston", () => {
    // 10pm on the 20th in Boston.
    assert.deepEqual(dueDateWindow(at("2026-11-21T03:00:00Z")), {
      from: "2026-11-19",
      to: "2026-11-22",
    });
  });
});

describe("eventRemindersFor", () => {
  const snap = (overrides: Partial<TaskSnapshot> = {}): TaskSnapshot => ({
    status: "TODO",
    dueDate: "2026-11-20",
    ownerId: OWNER,
    needsNewOwner: false,
    ...overrides,
  });

  test("a new task: assigned to the owner, and the schedule starts", () => {
    assert.deepEqual(eventRemindersFor(null, snap(), CREATOR), {
      reminders: [{ kind: "ASSIGNED", recipientId: OWNER }],
      restartSchedule: true,
    });
  });

  test("a task you made for yourself still gets the assigned DM", () => {
    assert.deepEqual(eventRemindersFor(null, snap(), OWNER).reminders, [
      { kind: "ASSIGNED", recipientId: OWNER },
    ]);
  });

  test("reassigned: assigned to the new owner, no longer yours to the old", () => {
    assert.deepEqual(
      eventRemindersFor(snap(), snap({ ownerId: SOMEONE }), CREATOR),
      {
        reminders: [
          { kind: "ASSIGNED", recipientId: SOMEONE },
          { kind: "REASSIGNED_AWAY", recipientId: OWNER },
        ],
        restartSchedule: true,
      },
    );
  });

  test("handing your own task to someone doesn't DM you", () => {
    assert.deepEqual(
      eventRemindersFor(snap(), snap({ ownerId: SOMEONE }), OWNER).reminders,
      [{ kind: "ASSIGNED", recipientId: SOMEONE }],
    );
  });

  test("new owner and new date: assigned carries the date, no date-changed", () => {
    assert.deepEqual(
      eventRemindersFor(
        snap(),
        snap({ ownerId: SOMEONE, dueDate: "2026-11-25" }),
        CREATOR,
      ).reminders,
      [
        { kind: "ASSIGNED", recipientId: SOMEONE },
        { kind: "REASSIGNED_AWAY", recipientId: OWNER },
      ],
    );
  });

  test("due date changed by the creator: the owner is told", () => {
    assert.deepEqual(
      eventRemindersFor(snap(), snap({ dueDate: "2026-11-25" }), CREATOR),
      {
        reminders: [{ kind: "DUE_DATE_CHANGED", recipientId: OWNER }],
        restartSchedule: true,
      },
    );
  });

  test("due date changed by the owner themselves: no DM, schedule restarts", () => {
    assert.deepEqual(
      eventRemindersFor(snap(), snap({ dueDate: "2026-11-25" }), OWNER),
      { reminders: [], restartSchedule: true },
    );
  });

  test("status or title changes send nothing and keep the schedule", () => {
    assert.deepEqual(
      eventRemindersFor(snap(), snap({ status: "IN_PROGRESS" }), OWNER),
      { reminders: [], restartSchedule: false },
    );
    assert.deepEqual(eventRemindersFor(snap(), snap(), CREATOR), {
      reminders: [],
      restartSchedule: false,
    });
  });

  test("nothing for a Done task, even when the date or owner moves", () => {
    assert.deepEqual(
      eventRemindersFor(
        snap(),
        snap({ status: "DONE", ownerId: SOMEONE, dueDate: "2026-11-25" }),
        CREATOR,
      ),
      { reminders: [], restartSchedule: true },
    );
    assert.deepEqual(
      eventRemindersFor(null, snap({ status: "DONE" }), CREATOR).reminders,
      [],
    );
  });

  test("nothing while the task needs a new owner", () => {
    assert.deepEqual(
      eventRemindersFor(
        snap({ needsNewOwner: true }),
        snap({ needsNewOwner: true, dueDate: "2026-11-25" }),
        CREATOR,
      ).reminders,
      [],
    );
  });

  test("taking over a task that needed a new owner: assigned, and the old owner's DM is recorded", () => {
    // The old owner is off the e-board, so the sender skips theirs.
    assert.deepEqual(
      eventRemindersFor(
        snap({ needsNewOwner: true }),
        snap({ ownerId: SOMEONE }),
        CREATOR,
      ).reminders,
      [
        { kind: "ASSIGNED", recipientId: SOMEONE },
        { kind: "REASSIGNED_AWAY", recipientId: OWNER },
      ],
    );
  });
});

describe("reminderStillWanted", () => {
  const current = (overrides: Partial<CurrentTask> = {}): CurrentTask => ({
    status: "TODO",
    dueDate: "2026-11-20",
    ownerId: OWNER,
    createdById: CREATOR,
    needsNewOwner: false,
    ...overrides,
  });
  const due = "2026-11-20";

  test("an unchanged task keeps every reminder", () => {
    for (const kind of [
      "ASSIGNED",
      "DUE_DATE_CHANGED",
      "DUE_SOON",
      "DUE_TODAY",
      "OVERDUE_OWNER",
    ] as const) {
      assert.equal(
        reminderStillWanted(
          { kind, recipientId: OWNER, dueDate: due },
          current(),
        ),
        true,
        kind,
      );
    }
    assert.equal(
      reminderStillWanted(
        { kind: "OVERDUE_CREATOR", recipientId: CREATOR, dueDate: due },
        current(),
      ),
      true,
    );
  });

  test("Done or needing a new owner cancels everything", () => {
    for (const t of [
      current({ status: "DONE" }),
      current({ needsNewOwner: true }),
    ]) {
      assert.equal(
        reminderStillWanted(
          { kind: "DUE_TODAY", recipientId: OWNER, dueDate: due },
          t,
        ),
        false,
      );
      assert.equal(
        reminderStillWanted(
          { kind: "REASSIGNED_AWAY", recipientId: SOMEONE, dueDate: due },
          t,
        ),
        false,
      );
    }
  });

  test("a reminder for the old owner is dropped after a reassignment", () => {
    const t = current({ ownerId: SOMEONE });
    assert.equal(
      reminderStillWanted(
        { kind: "ASSIGNED", recipientId: OWNER, dueDate: due },
        t,
      ),
      false,
    );
    assert.equal(
      reminderStillWanted(
        { kind: "DUE_TODAY", recipientId: OWNER, dueDate: due },
        t,
      ),
      false,
    );
  });

  test("a reminder about the old date is dropped after a date change", () => {
    const t = current({ dueDate: "2026-11-25" });
    for (const kind of ["ASSIGNED", "DUE_TODAY", "DUE_DATE_CHANGED"] as const) {
      assert.equal(
        reminderStillWanted({ kind, recipientId: OWNER, dueDate: due }, t),
        false,
        kind,
      );
    }
    assert.equal(
      reminderStillWanted(
        { kind: "OVERDUE_CREATOR", recipientId: CREATOR, dueDate: due },
        t,
      ),
      false,
    );
  });

  test("no longer yours: kept if the date moves, dropped if it comes back", () => {
    const away = {
      kind: "REASSIGNED_AWAY" as const,
      recipientId: OWNER,
      dueDate: due,
    };
    assert.equal(
      reminderStillWanted(
        away,
        current({ ownerId: SOMEONE, dueDate: "2026-11-25" }),
      ),
      true,
    );
    assert.equal(reminderStillWanted(away, current({ ownerId: OWNER })), false);
  });
});

describe("afterFailedSend", () => {
  const first = at("2026-11-20T14:00:00Z");

  test("no bot token: skipped, not a failure", () => {
    assert.deepEqual(
      afterFailedSend(
        { error: "not_configured", retryable: false },
        first,
        first,
      ),
      { status: "SKIPPED" },
    );
  });

  test("Slack down: tried again in about an hour", () => {
    const now = at("2026-11-20T14:00:05Z");
    const next = afterFailedSend(
      { error: "http_503", retryable: true },
      first,
      now,
    );
    assert.deepEqual(next, {
      status: "PENDING",
      nextAttemptAt: at("2026-11-20T14:50:05Z"),
    });
  });

  test("rate limited for longer than an hour: waits as long as Slack asked", () => {
    const next = afterFailedSend(
      { error: "ratelimited", retryable: true, retryAfterSeconds: 7200 },
      first,
      first,
    );
    assert.deepEqual(next, {
      status: "PENDING",
      nextAttemptAt: at("2026-11-20T16:00:00Z"),
    });
  });

  test("still failing a day after the first try: given up", () => {
    const retry = { error: "network_error", retryable: true };
    assert.equal(
      afterFailedSend(retry, first, at("2026-11-21T13:00:00Z")).status,
      "PENDING",
    );
    assert.deepEqual(
      afterFailedSend(retry, first, at("2026-11-21T14:00:00Z")),
      {
        status: "FAILED",
      },
    );
  });

  test("a broken bot (bad token, missing scope) is retried for the day", () => {
    for (const error of ["invalid_auth", "missing_scope", "token_revoked"]) {
      assert.equal(
        afterFailedSend({ error, retryable: false }, first, first).status,
        "PENDING",
        error,
      );
    }
  });

  test("a problem with the person fails right away", () => {
    for (const error of [
      "user_not_found",
      "channel_not_found",
      "invalid_member_id",
    ]) {
      assert.deepEqual(
        afterFailedSend({ error, retryable: false }, first, first),
        {
          status: "FAILED",
        },
      );
    }
  });
});

describe("isReminderUndelivered", () => {
  const open = { status: "TODO", ownerId: OWNER, createdById: CREATOR };
  const r = (status: string, recipientId: number) => ({ status, recipientId });

  test("the latest finished reminder to the owner failed", () => {
    assert.equal(isReminderUndelivered(open, [r("FAILED", OWNER)]), true);
    assert.equal(
      isReminderUndelivered({ ...open, status: "IN_PROGRESS" }, [
        r("FAILED", OWNER),
      ]),
      true,
    );
  });

  test("a later one that got through clears it", () => {
    assert.equal(
      isReminderUndelivered(open, [r("SENT", OWNER), r("FAILED", OWNER)]),
      false,
    );
  });

  test("the creator hearing about it doesn't clear the owner's failure", () => {
    assert.equal(
      isReminderUndelivered(open, [r("SENT", CREATOR), r("FAILED", OWNER)]),
      true,
    );
  });

  test("the creator's own failure counts too", () => {
    assert.equal(
      isReminderUndelivered(open, [r("SENT", OWNER), r("FAILED", CREATOR)]),
      true,
    );
  });

  test("a previous owner's failed 'no longer yours' doesn't count", () => {
    assert.equal(isReminderUndelivered(open, [r("FAILED", SOMEONE)]), false);
  });

  test("nothing finished, or the task is Done: no badge", () => {
    assert.equal(isReminderUndelivered(open, []), false);
    assert.equal(
      isReminderUndelivered({ ...open, status: "DONE" }, [r("FAILED", OWNER)]),
      false,
    );
  });
});
