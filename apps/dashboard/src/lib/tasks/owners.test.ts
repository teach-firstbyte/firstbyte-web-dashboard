import assert from "node:assert/strict";
import { test } from "node:test";

import {
  matchOwners,
  ownerName,
  ownerRole,
  ownerTeamId,
  type OwnerChoice,
} from "./owners.ts";

const person = (
  id: number,
  name: string | null,
  leads: string[] = [],
  preferredName: string | null = null,
): OwnerChoice => ({
  id,
  name,
  preferredName,
  leads: leads.map((t, i) => ({ id: id * 10 + i, name: t })),
});

const MAYA = person(1, "Maya Okafor");
const PRIYA = person(2, "Priya Nair", ["Events"]);
const JORDAN = person(3, "Jordan Lee", ["CS Curricula"]);
const ALEX = person(4, "Alex Kim", ["STEM Curricula"]);
const RILEY = person(5, "Riley Chen", ["Brand and Marketing"]);
const SAM = person(6, "Sam Patel", ["Website"], "Sammy");
const BOARD = [MAYA, PRIYA, JORDAN, ALEX, RILEY, SAM];

const names = (q: string) => matchOwners(q, BOARD).map(ownerName);

test("an empty query lists everyone, in order", () => {
  assert.deepEqual(names(""), names("  "));
  assert.equal(names("").length, BOARD.length);
});

test("matches first and last names, any case", () => {
  assert.deepEqual(names("pri"), ["Priya Nair"]);
  assert.deepEqual(names("NAIR"), ["Priya Nair"]);
  assert.deepEqual(names("lee"), ["Jordan Lee"]);
  assert.deepEqual(names("jordan l"), ["Jordan Lee"]);
  assert.deepEqual(names("  maya   okafor "), ["Maya Okafor"]);
});

test("matches the preferred name", () => {
  assert.deepEqual(names("sammy"), ["Sam Patel"]);
});

test("matches roles: the team someone leads, or 'lead'", () => {
  assert.deepEqual(names("events"), ["Priya Nair"]);
  assert.deepEqual(names("brand"), ["Riley Chen"]);
  assert.deepEqual(names("marketing"), ["Riley Chen"]);
  assert.deepEqual(names("curricula"), ["Jordan Lee", "Alex Kim"]);
  assert.deepEqual(names("cs"), ["Jordan Lee"]);
  assert.deepEqual(names("web"), ["Sam Patel"]);
  assert.deepEqual(names("e-board"), ["Maya Okafor"]);
});

test("name matches come before role matches", () => {
  // "s": Sam by name, then Alex (STEM) by role.
  assert.deepEqual(names("s"), ["Sam Patel", "Alex Kim"]);
});

test("a typo matches no one", () => {
  assert.deepEqual(names("priay"), []);
  assert.deepEqual(names("zed"), []);
});

test("labels", () => {
  assert.equal(ownerName(person(9, null, [], "Kit")), "Kit");
  assert.equal(ownerName(person(9, "  ", [], null)), "Unnamed member");
  assert.equal(ownerRole(PRIYA), "Events lead");
  assert.equal(ownerRole(MAYA), "E-board");
  assert.equal(
    ownerRole(person(9, "Two Hats", ["CS Curricula", "Website"])),
    "CS Curricula lead, Website lead",
  );
});

test("the task's team is the team the owner leads", () => {
  assert.equal(ownerTeamId(PRIYA), PRIYA.leads[0].id);
  assert.equal(ownerTeamId(MAYA), null);
});
