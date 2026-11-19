/**
 * The permission rules for e-board tasks. Run with `npm test`.
 *
 * Node runs this file as it is (it strips the types), with no test framework
 * installed. Node can't resolve "./taskPolicy" without its extension, and tsc
 * won't accept "./taskPolicy.ts", so the module is loaded by URL and typed
 * from a type-only import, which Node erases.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

type Policy = typeof import("./taskPolicy");
const {
  canAccessTasks,
  canChangeTaskStatus,
  canDeleteTask,
  canEditTask,
  canUpdateTaskFields,
} = (await import(new URL("./taskPolicy.ts", import.meta.url).href)) as Policy;

const OWNER = 1;
const CREATOR = 2;
const task = { ownerId: OWNER, createdById: CREATOR };

const people = {
  owner: { id: OWNER, isSuperAdmin: false, isEboardMember: true },
  creator: { id: CREATOR, isSuperAdmin: false, isEboardMember: true },
  superAdmin: { id: 3, isSuperAdmin: true, isEboardMember: true },
  // A super admin who isn't on the EBOARD team still gets in.
  superAdminOffBoard: { id: 4, isSuperAdmin: true, isEboardMember: false },
  otherEboardMember: { id: 5, isSuperAdmin: false, isEboardMember: true },
  clubMember: { id: 6, isSuperAdmin: false, isEboardMember: false },
  // The owner and creator after they leave the e-board.
  formerOwner: { id: OWNER, isSuperAdmin: false, isEboardMember: false },
  formerCreator: { id: CREATOR, isSuperAdmin: false, isEboardMember: false },
};

const EDIT_FIELDS = [
  "title",
  "ownerId",
  "dueDate",
  "teamId",
  "meetingId",
  "notes",
];

describe("canAccessTasks", () => {
  test("lets e-board members and super admins in", () => {
    assert.equal(canAccessTasks(people.otherEboardMember), true);
    assert.equal(canAccessTasks(people.superAdmin), true);
    assert.equal(canAccessTasks(people.superAdminOffBoard), true);
  });

  test("keeps club members out", () => {
    assert.equal(canAccessTasks(people.clubMember), false);
    assert.equal(canAccessTasks(people.formerOwner), false);
  });
});

describe("owner", () => {
  test("can change status", () => {
    assert.equal(canChangeTaskStatus(people.owner, task), true);
    assert.equal(canUpdateTaskFields(people.owner, task, ["status"]), true);
  });

  test("can't change anything else, or delete", () => {
    assert.equal(canEditTask(people.owner, task), false);
    assert.equal(canDeleteTask(people.owner, task), false);
    for (const field of EDIT_FIELDS) {
      assert.equal(
        canUpdateTaskFields(people.owner, task, [field]),
        false,
        field,
      );
    }
  });

  test("can't sneak an edit in alongside a status change", () => {
    assert.equal(
      canUpdateTaskFields(people.owner, task, ["status", "dueDate"]),
      false,
    );
  });

  test("loses everything after leaving the e-board", () => {
    assert.equal(canChangeTaskStatus(people.formerOwner, task), false);
  });
});

describe("creator", () => {
  test("can change every field and delete", () => {
    assert.equal(canEditTask(people.creator, task), true);
    assert.equal(canDeleteTask(people.creator, task), true);
    assert.equal(canChangeTaskStatus(people.creator, task), true);
    assert.equal(
      canUpdateTaskFields(people.creator, task, [...EDIT_FIELDS, "status"]),
      true,
    );
  });

  test("loses everything after leaving the e-board", () => {
    assert.equal(canEditTask(people.formerCreator, task), false);
    assert.equal(canDeleteTask(people.formerCreator, task), false);
  });
});

describe("super admin", () => {
  test("can change every field and delete any task", () => {
    for (const admin of [people.superAdmin, people.superAdminOffBoard]) {
      assert.equal(canEditTask(admin, task), true);
      assert.equal(canDeleteTask(admin, task), true);
      assert.equal(
        canUpdateTaskFields(admin, task, [...EDIT_FIELDS, "status"]),
        true,
      );
    }
  });
});

describe("other e-board member", () => {
  test("can read, but can't change or delete someone else's task", () => {
    const actor = people.otherEboardMember;
    assert.equal(canAccessTasks(actor), true);
    assert.equal(canChangeTaskStatus(actor, task), false);
    assert.equal(canEditTask(actor, task), false);
    assert.equal(canDeleteTask(actor, task), false);
    assert.equal(canUpdateTaskFields(actor, task, ["status"]), false);
  });
});

describe("club member", () => {
  test("can't do anything, even on a task that names them", () => {
    const actor = people.clubMember;
    // Their own id as owner and creator: access is checked first.
    const theirs = { ownerId: actor.id, createdById: actor.id };
    assert.equal(canChangeTaskStatus(actor, theirs), false);
    assert.equal(canEditTask(actor, theirs), false);
    assert.equal(canDeleteTask(actor, theirs), false);
    assert.equal(canUpdateTaskFields(actor, theirs, ["status"]), false);
  });
});
