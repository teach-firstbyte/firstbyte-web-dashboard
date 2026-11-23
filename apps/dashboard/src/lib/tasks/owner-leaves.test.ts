/**
 * #140: when a task's owner leaves the e-board (taken off the EBOARD team) or
 * deletes their account, their open tasks are kept and need a new owner:
 * the board shows them under "Needs a new owner", their reminders stop, they
 * appear in the weekly summary, and nothing is deleted.
 *
 * Each step is a pure rule with its own tests elsewhere. This follows one
 * task through all of them, and checks the schema and the account deletion
 * code keep the tasks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { groupTasks, summarize, type BoardTaskFields } from "./board.ts";
import { ownerNeedsReplacing } from "./owners.ts";
import {
  eventRemindersFor,
  reminderStillWanted,
  scheduledRemindersDue,
} from "./reminders.ts";
import { buildWeeklySummary } from "./weekly-summary.ts";

const OWNER = 1;
const CREATOR = 2;

/** The owner as the server reads them (AccountStatus, EBOARD memberships). */
const ON_EBOARD = { accountStatus: "APPROVED", eboardMemberships: 1 };
const TAKEN_OFF_EBOARD = { accountStatus: "APPROVED", eboardMemberships: 0 };
// deleteOwnAccount: status DELETED, and every team membership removed.
const ACCOUNT_DELETED = { accountStatus: "DELETED", eboardMemberships: 0 };

describe("who needs replacing", () => {
  test("someone on the e-board doesn't", () => {
    assert.equal(ownerNeedsReplacing(ON_EBOARD), false);
  });

  test("taken off the EBOARD team", () => {
    assert.equal(ownerNeedsReplacing(TAKEN_OFF_EBOARD), true);
  });

  test("account deleted", () => {
    assert.equal(ownerNeedsReplacing(ACCOUNT_DELETED), true);
    // Even if a membership row were somehow left behind.
    assert.equal(
      ownerNeedsReplacing({ accountStatus: "DELETED", eboardMemberships: 1 }),
      true,
    );
  });

  test("any account that isn't approved", () => {
    for (const accountStatus of ["DENIED", "PENDING", "ONBOARDING"]) {
      assert.equal(
        ownerNeedsReplacing({ accountStatus, eboardMemberships: 1 }),
        true,
        accountStatus,
      );
    }
  });
});

// One open task, due Friday November 20, 2026, owned by someone who then
// leaves. 9am Boston is 14:00 UTC in November.
const DUE = "2026-11-20";
const DUE_DAY_9AM = new Date("2026-11-20T14:00:00Z");

for (const [how, owner] of [
  ["taken off the EBOARD team", TAKEN_OFF_EBOARD],
  ["deletes their account", ACCOUNT_DELETED],
] as const) {
  describe(`the owner ${how}`, () => {
    const needsNewOwner = ownerNeedsReplacing(owner);

    test("the board puts the task under Needs a new owner, first", () => {
      const tasks: BoardTaskFields[] = [
        {
          id: 1,
          status: "IN_PROGRESS",
          dueDate: DUE,
          ownerId: OWNER,
          teamId: null,
          isOverdue: false,
          needsNewOwner,
        },
        {
          id: 2,
          status: "TODO",
          dueDate: DUE,
          ownerId: CREATOR,
          teamId: null,
          isOverdue: false,
          needsNewOwner: false,
        },
      ];
      const groups = groupTasks(tasks, {
        filters: { groupBy: "owner", mine: false, showDone: false },
        viewerId: CREATOR,
        // The person who left is no longer in the e-board list.
        ownerIds: [CREATOR],
        teamIds: [],
      });
      assert.equal(groups[0].kind, "needsOwner");
      assert.deepEqual(
        groups[0].tasks.map((t) => t.id),
        [1],
      );
      // Not also under them, or anyone else.
      for (const g of groups.slice(1)) {
        assert.ok(!g.tasks.some((t) => t.id === 1));
      }
      assert.equal(summarize(tasks, "2026-11-18").needsNewOwner, 1);
    });

    test("no scheduled reminder goes out, to the owner or the creator", () => {
      const reminderTask = {
        status: "TODO",
        dueDate: DUE,
        ownerId: OWNER,
        createdById: CREATOR,
        needsNewOwner,
        remindersFrom: new Date("2026-11-10T15:00:00Z"),
      };
      for (const now of [
        new Date("2026-11-18T14:00:00Z"), // 2 days before
        DUE_DAY_9AM, // due today
        new Date("2026-11-21T14:00:00Z"), // 1 day overdue
      ]) {
        assert.deepEqual(scheduledRemindersDue(reminderTask, now), []);
      }
      // The same task with its owner still there would have had them.
      assert.equal(
        scheduledRemindersDue(
          { ...reminderTask, needsNewOwner: false },
          DUE_DAY_9AM,
        ).length,
        1,
      );
    });

    test("a reminder already waiting is cancelled, not sent", () => {
      const current = {
        status: "TODO",
        dueDate: DUE,
        ownerId: OWNER,
        createdById: CREATOR,
        needsNewOwner,
      };
      for (const kind of [
        "DUE_SOON",
        "DUE_TODAY",
        "OVERDUE_OWNER",
        "ASSIGNED",
      ] as const) {
        assert.equal(
          reminderStillWanted(
            { kind, recipientId: OWNER, dueDate: DUE },
            current,
          ),
          false,
          kind,
        );
      }
      assert.equal(
        reminderStillWanted(
          { kind: "OVERDUE_CREATOR", recipientId: CREATOR, dueDate: DUE },
          current,
        ),
        false,
      );
    });

    test("editing it without a new owner sends nothing", () => {
      const snap = {
        status: "TODO",
        dueDate: DUE,
        ownerId: OWNER,
        needsNewOwner,
      };
      assert.deepEqual(
        eventRemindersFor(snap, { ...snap, dueDate: "2026-11-27" }, CREATOR)
          .reminders,
        [],
      );
    });

    test("it's in the weekly summary under Needs a new owner", () => {
      const summary = buildWeeklySummary({
        today: "2026-11-23",
        tasks: [
          {
            id: 1,
            title: "Count robotics kits",
            status: "IN_PROGRESS",
            dueDate: DUE,
            ownerId: OWNER,
            ownerName: owner === ACCOUNT_DELETED ? "Former member" : "Alex Kim",
            needsNewOwner,
          },
        ],
        // They're off the e-board, so not in this list.
        eboard: [{ id: CREATOR, name: "Maya Chen", slackConnected: true }],
      });
      assert.deepEqual(
        summary.needsNewOwner.map((t) => t.id),
        [1],
      );
      assert.deepEqual(summary.people, []);
      assert.equal(summary.counts.open, 1);
    });
  });
}

describe("nothing is deleted", () => {
  const read = (path: string) =>
    readFileSync(new URL(path, import.meta.url), "utf8");

  test("the schema keeps a task when its owner or creator is deleted", () => {
    const schema = read("../../../prisma/schema.prisma");
    const task = schema.slice(
      schema.indexOf("model Task {"),
      schema.indexOf("}", schema.indexOf("model Task {")),
    );
    assert.match(
      task,
      /owner\s+User\s+@relation\("TaskOwner",[^)]*onDelete: Restrict\)/,
    );
    assert.match(
      task,
      /createdBy\s+User\s+@relation\("TaskCreator",[^)]*onDelete: Restrict\)/,
    );
  });

  test("so does the database", () => {
    const sql = read(
      "../../../prisma/migrations/20261119010108_eboard_tasks/migration.sql",
    );
    assert.match(
      sql,
      /"tasks_owner_id_fkey" FOREIGN KEY \("owner_id"\) REFERENCES "users"\("id"\) ON DELETE RESTRICT/,
    );
    assert.match(
      sql,
      /"tasks_created_by_id_fkey" FOREIGN KEY \("created_by_id"\) REFERENCES "users"\("id"\) ON DELETE RESTRICT/,
    );
  });

  test("deleting an account keeps the row and touches no task", () => {
    const users = read("../../server/users/mutations.ts");
    const start = users.indexOf("async function anonymizeAccount");
    const body = users.slice(start, users.indexOf("\n}\n", start));
    // It anonymises the row (status DELETED) rather than deleting it...
    assert.match(body, /prisma\.user\.update\(/);
    assert.match(body, /status: AccountStatus\.DELETED/);
    assert.doesNotMatch(body, /prisma\.user\.delete/);
    // ...and removes the memberships, which is what marks the tasks.
    assert.match(body, /prisma\.teamMember\.deleteMany/);
    assert.doesNotMatch(body, /prisma\.task\b/);
  });

  test("no code deletes tasks except a person deleting one task", () => {
    const mutations = read("../../server/tasks/mutations.ts");
    assert.doesNotMatch(mutations, /task\.deleteMany/);
  });
});
