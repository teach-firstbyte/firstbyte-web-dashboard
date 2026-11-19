import assert from "node:assert/strict";
import { test } from "node:test";

import { isSlackMemberId, normalizeSlackMemberId } from "./slack-member-id.ts";

test("accepts real-looking member IDs", () => {
  for (const id of [
    "U0CK0SKF78E", // sandbox Maya, 11 after the U
    "U07ABC1234", // 9 after the U, the mockup's example
    "W012A3CDE", // Enterprise Grid, 8 after the W
    "U12345678901", // 11 digits
  ]) {
    assert.equal(isSlackMemberId(id), true, id);
  }
});

test("rejects anything else", () => {
  for (const id of [
    "",
    "U1234567", // 7 after the U: too short
    "U123456789012", // 12 after the U: too long
    "C0CK0SKF78E", // a channel ID
    "B0CK0SKF78E", // a bot ID
    "u0ck0skf78e", // lower case isn't normalized by isSlackMemberId
    " U0CK0SKF78E",
    "U0CK0SKF78E ",
    "U0CK0-KF78E",
    "@maya",
    "maya@example.com",
  ]) {
    assert.equal(isSlackMemberId(id), false, JSON.stringify(id));
  }
});

test("normalize cleans up pasted input", () => {
  assert.equal(normalizeSlackMemberId("  u0ck0skf78e \n"), "U0CK0SKF78E");
  assert.equal(normalizeSlackMemberId("@U0CKX75N8L8"), "U0CKX75N8L8");
  assert.equal(normalizeSlackMemberId("W012A3CDE"), "W012A3CDE");
});

test("normalize returns null for non-IDs", () => {
  assert.equal(normalizeSlackMemberId(""), null);
  assert.equal(normalizeSlackMemberId("   "), null);
  assert.equal(normalizeSlackMemberId("Maya Okafor"), null);
  assert.equal(normalizeSlackMemberId("C0CK0SKF78E"), null);
  assert.equal(
    normalizeSlackMemberId("https://x.slack.com/team/U0CK0SKF78E"),
    null,
  );
});
