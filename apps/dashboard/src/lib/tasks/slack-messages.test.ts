import assert from "node:assert/strict";
import { test } from "node:test";

import {
  escapeSlackText,
  formatDueDate,
  formatShortDate,
  taskAssignedMessage,
  taskDueDateChangedMessage,
  taskDueSoonMessage,
  taskDueTodayMessage,
  taskOverdueCreatorMessage,
  taskOverdueOwnerMessage,
  taskReassignedAwayMessage,
} from "./slack-messages.ts";

const DASHBOARD_URL = "https://teachfirstbyte.com/dashboard/tasks";
const LINK = `<${DASHBOARD_URL}|Open in dashboard>`;

test("dates print as the calendar day, whatever the time zone", () => {
  assert.equal(formatDueDate("2026-11-20"), "Fri, Nov 20");
  assert.equal(formatShortDate("2026-11-11"), "Nov 11");
  // What Prisma returns for a @db.Date column: UTC midnight. In Boston that's
  // the evening before, which must not leak into the message.
  assert.equal(
    formatDueDate(new Date("2026-11-20T00:00:00.000Z")),
    "Fri, Nov 20",
  );
});

test("bad dates throw instead of printing nonsense", () => {
  assert.throws(() => formatDueDate("11/20/2026"), RangeError);
  assert.throws(() => formatDueDate("2026-02-30"), RangeError);
  assert.throws(() => formatDueDate(new Date("nope")), RangeError);
});

test("escapes Slack control characters", () => {
  assert.equal(
    escapeSlackText("<!channel> & <@U1>"),
    "&lt;!channel&gt; &amp; &lt;@U1&gt;",
  );
});

test("assigned, with everything", () => {
  const { text } = taskAssignedMessage({
    title: "Book Curry 340 for the December GBM",
    dueDate: "2026-11-20",
    assignedByName: "Maya",
    team: "Events",
    meetingDate: "2026-11-11",
    url: DASHBOARD_URL,
  });
  assert.equal(
    text,
    [
      "Maya assigned you a task: *Book Curry 340 for the December GBM*",
      "Due Fri, Nov 20 · Events · From the e-board meeting on Nov 11",
      LINK,
    ].join("\n"),
  );
});

test("assigned, made by the owner, no team or meeting", () => {
  const { text } = taskAssignedMessage({
    title: "Order snacks",
    dueDate: "2026-11-20",
    assignedByName: null,
    url: DASHBOARD_URL,
  });
  assert.equal(
    text,
    ["You have a new task: *Order snacks*", "Due Fri, Nov 20", LINK].join("\n"),
  );
});

test("due in 2 days", () => {
  const { text } = taskDueSoonMessage({
    title: "Book Curry 340 for the December GBM",
    dueDate: "2026-11-20",
    statusLabel: "In progress",
    url: DASHBOARD_URL,
  });
  assert.equal(
    text,
    [
      "*Book Curry 340 for the December GBM* is due in 2 days, on Fri, Nov 20.",
      "Status: In progress",
      LINK,
    ].join("\n"),
  );
});

test("due today", () => {
  const { text } = taskDueTodayMessage({
    title: "Order FirstBites snacks (budget $120)",
    statusLabel: "To do",
    url: DASHBOARD_URL,
  });
  assert.equal(
    text,
    [
      "*Order FirstBites snacks (budget $120)* is due today.",
      "Status: To do. Mark it done in the dashboard and the reminders stop.",
      LINK,
    ].join("\n"),
  );
});

test("overdue, to the owner", () => {
  const base = {
    title: "Count robotics kits after the STEM workshop",
    dueDate: "2026-11-17",
    url: DASHBOARD_URL,
  };
  assert.equal(
    taskOverdueOwnerMessage({ ...base, creatorName: "Maya" }).text,
    [
      "*Count robotics kits after the STEM workshop* was due yesterday, Tue, Nov 17.",
      "Update the status, or ask Maya for a new date.",
      LINK,
    ].join("\n"),
  );
  assert.match(
    taskOverdueOwnerMessage({ ...base, creatorName: null }).text,
    /^Update the status, or change the due date\.$/m,
  );
});

test("overdue, to the creator", () => {
  const { text } = taskOverdueCreatorMessage({
    title: "Count robotics kits after the STEM workshop",
    ownerName: "Alex Kim",
    url: DASHBOARD_URL,
  });
  assert.equal(
    text,
    [
      "Heads up: *Count robotics kits after the STEM workshop*, owned by Alex Kim, was due yesterday.",
      LINK,
    ].join("\n"),
  );
});

test("due date changed", () => {
  const { text } = taskDueDateChangedMessage({
    title: "Finalize the intro to Python workshop slides",
    oldDueDate: "2026-11-23",
    newDueDate: "2026-11-27",
    changedByName: "Maya",
    url: DASHBOARD_URL,
  });
  assert.equal(
    text,
    [
      "Maya moved the due date for *Finalize the intro to Python workshop slides* from Mon, Nov 23 to Fri, Nov 27.",
      LINK,
    ].join("\n"),
  );
});

test("reassigned away has no link", () => {
  const { text } = taskReassignedAwayMessage({
    title: "Confirm three judges for hack night",
    newOwnerName: "Jordan Lee",
    reassignedByName: "Maya",
  });
  assert.equal(
    text,
    "*Confirm three judges for hack night* was reassigned to Jordan Lee by Maya. It's off your list.",
  );
});

test("user text can't inject mentions or links", () => {
  const { text } = taskAssignedMessage({
    title: "<!channel> read <https://evil.example|this>",
    dueDate: "2026-11-20",
    assignedByName: "<@U0CK0SKF78E>",
    team: "A & B",
    url: "https://teachfirstbyte.com/dashboard/tasks?x=<y>|z",
  });
  assert.doesNotMatch(text, /<!channel>|<@U|<https:\/\/evil/);
  assert.match(text, /A &amp; B/);
  assert.ok(
    text.endsWith(
      "<https://teachfirstbyte.com/dashboard/tasks?x=%3Cy%3E%7Cz|Open in dashboard>",
    ),
  );
});
