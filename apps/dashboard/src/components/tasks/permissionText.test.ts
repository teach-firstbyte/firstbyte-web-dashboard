import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { lockedHint, permissionNote } from "./permissionText.ts";

const PRIYA = { id: 1, name: "Priya Shah", preferredName: null };
const SAM = { id: 2, name: "Sam Lee", preferredName: null };
const NAMELESS = { id: 3, name: null, preferredName: "  " };

type Person = typeof PRIYA | typeof NAMELESS;

function task({
  owner = PRIYA as Person,
  createdBy = SAM as Person,
  needsNewOwner = false,
  changeStatus = false,
} = {}) {
  return {
    ownerId: owner.id,
    createdById: createdBy.id,
    owner,
    createdBy,
    needsNewOwner,
    can: { changeStatus, edit: false, delete: false },
  };
}

describe("lockedHint", () => {
  test("names the owner, the creator and the super admins", () => {
    assert.equal(
      lockedHint(task()),
      "Only Priya (the owner), Sam Lee (the creator), or the president, VP and website lead can change this",
    );
  });

  test("leaves out an owner who has left the e-board", () => {
    assert.equal(
      lockedHint(task({ needsNewOwner: true })),
      "Only Sam Lee (the creator) or the president, VP and website lead can change this",
    );
  });

  test("names an owner who created the task once", () => {
    assert.equal(
      lockedHint(task({ createdBy: PRIYA })),
      "Only Priya Shah (the owner and creator) or the president, VP and website lead can change this",
    );
  });

  test("leaves only the super admins when that owner has left", () => {
    assert.equal(
      lockedHint(task({ createdBy: PRIYA, needsNewOwner: true })),
      "Only the president, VP and website lead can change this",
    );
  });

  test("tells two people with one first name apart", () => {
    const samOwner = { id: 4, name: "Sam Ortiz", preferredName: null };
    assert.equal(
      lockedHint(task({ owner: samOwner })),
      "Only Sam (the owner), Sam Lee (the creator), or the president, VP and website lead can change this",
    );
  });

  test("says the role when an account has no name", () => {
    const createdBy = { ...NAMELESS, id: 5 };
    assert.equal(
      lockedHint(task({ owner: NAMELESS, createdBy })),
      "Only the owner, the creator, or the president, VP and website lead can change this",
    );
  });
});

describe("permissionNote", () => {
  test("tells the owner who can change the rest", () => {
    assert.equal(
      permissionNote(task({ changeStatus: true })),
      "You can change the status. Only Sam Lee, who created this, or the president, VP and website lead can change the rest.",
    );
  });

  test("names the owner and the creator to anyone else", () => {
    assert.equal(
      permissionNote(task()),
      "This task is read-only for you. Priya, who owns it, can change the status. Sam Lee, who created it, and the president, VP and website lead can change everything.",
    );
  });

  test("leaves out an owner who has left the e-board", () => {
    assert.equal(
      permissionNote(task({ needsNewOwner: true })),
      "This task is read-only for you. Sam Lee, who created it, and the president, VP and website lead can change everything.",
    );
  });

  test("names an owner who created the task once", () => {
    assert.equal(
      permissionNote(task({ createdBy: PRIYA })),
      "This task is read-only for you. Priya Shah, who owns and created it, and the president, VP and website lead can change everything.",
    );
  });

  test("leaves only the super admins when that owner has left", () => {
    assert.equal(
      permissionNote(task({ createdBy: PRIYA, needsNewOwner: true })),
      "This task is read-only for you. Only the president, VP and website lead can change it.",
    );
  });

  test("says the role when an account has no name", () => {
    const createdBy = { ...NAMELESS, id: 5 };
    assert.equal(
      permissionNote(task({ owner: NAMELESS, createdBy })),
      "This task is read-only for you. The owner can change the status. The creator and the president, VP and website lead can change everything.",
    );
    assert.equal(
      permissionNote(task({ createdBy, changeStatus: true })),
      "You can change the status. Only the creator or the president, VP and website lead can change the rest.",
    );
  });
});
