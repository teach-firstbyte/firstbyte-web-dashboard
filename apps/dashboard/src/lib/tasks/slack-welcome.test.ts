import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_SUMMARY_SCHEDULE, scheduleLabel } from "./weekly-summary.ts";
import {
  greetingName,
  linkedDescription,
  welcomeDmFor,
  welcomeMessage,
} from "./slack-welcome.ts";

const DASHBOARD_URL = "https://teachfirstbyte.com/dashboard/tasks";

const MEMBER_TEXT = [
  "Hi Priya! I'm FirstByte Tasks, the e-board's task reminder bot.",
  "I'll DM you when a task is assigned to you or its due date changes, 2 days before it's due, on the due date at 9am, and if it's overdue.",
  `See and update your tasks in the dashboard: <${DASHBOARD_URL}|Open your tasks>`,
  "You can't reply here. If anything looks wrong, ask the president.",
].join("\n");

test("welcome, to a regular e-board member", () => {
  const { text } = welcomeMessage({
    firstName: "Priya",
    weeklySummary: null,
    url: DASHBOARD_URL,
  });
  assert.equal(text, MEMBER_TEXT);
  assert.doesNotMatch(text, /weekly summary/);
});

test("welcome, to a super admin, with the club's summary setting", () => {
  const { text } = welcomeMessage({
    firstName: "Maya",
    weeklySummary: scheduleLabel(DEFAULT_SUMMARY_SCHEDULE),
    url: DASHBOARD_URL,
  });
  assert.equal(
    text,
    [
      "Hi Maya! I'm FirstByte Tasks, the e-board's task reminder bot.",
      "I'll DM you when a task is assigned to you or its due date changes, 2 days before it's due, on the due date at 9am, and if it's overdue.",
      "You'll also get the weekly summary, Mondays at 9:00 AM: what's overdue or due in the next 7 days, by person.",
      `See and update your tasks in the dashboard: <${DASHBOARD_URL}|Open your tasks>`,
      "You can't reply here. If anything looks wrong, ask the president.",
    ].join("\n"),
  );
  // A changed setting shows as it is.
  const thursday = welcomeMessage({
    firstName: "Maya",
    weeklySummary: scheduleLabel({ day: 4, hour: 17 }),
    url: DASHBOARD_URL,
  }).text;
  assert.match(thursday, /weekly summary, Thursdays at 5:00 PM:/);
});

test("welcome with no name just says hi", () => {
  const { text } = welcomeMessage({
    firstName: null,
    weeklySummary: null,
    url: DASHBOARD_URL,
  });
  assert.match(text, /^Hi! I'm FirstByte Tasks/);
});

test("welcome: names can't inject mentions, and the link stays one link", () => {
  const { text } = welcomeMessage({
    firstName: "<!channel>",
    weeklySummary: null,
    url: "https://x.test/tasks?a=1|<@U1>",
  });
  assert.match(text, /^Hi &lt;!channel&gt;!/);
  assert.doesNotMatch(text, /<!channel>|<@U1>/);
  assert.match(
    text,
    /<https:\/\/x\.test\/tasks\?a=1%7C%3C@U1%3E\|Open your tasks>/,
  );
});

test("greeting name: preferred name, else the first word of the name", () => {
  assert.equal(
    greetingName({ name: "Priya Raman", preferredName: null }),
    "Priya",
  );
  assert.equal(
    greetingName({ name: "Daniel Kim", preferredName: " Danny " }),
    "Danny",
  );
  assert.equal(greetingName({ name: "  ", preferredName: "" }), null);
  assert.equal(greetingName({ name: null, preferredName: null }), null);
});

test("welcome DM: new links and changed IDs get one, a re-save doesn't", () => {
  const on = { botConfigured: true };
  assert.equal(
    welcomeDmFor({ ...on, before: null, after: "U0123456789" }),
    "sending",
  );
  assert.equal(
    welcomeDmFor({ ...on, before: "U0123456789", after: "U0999999999" }),
    "sending",
  );
  assert.equal(
    welcomeDmFor({ ...on, before: "U0123456789", after: "U0123456789" }),
    "not_needed",
  );
  const off = { botConfigured: false };
  assert.equal(
    welcomeDmFor({ ...off, before: null, after: "U0123456789" }),
    "no_bot_token",
  );
  assert.equal(
    welcomeDmFor({ ...off, before: "U0123456789", after: "U0123456789" }),
    "not_needed",
  );
});

test("the setup page says whether a welcome DM is on its way", () => {
  assert.equal(
    linkedDescription("Priya Raman", "sending"),
    "A welcome DM is on its way to Priya, and reminders start with the next one.",
  );
  assert.match(
    linkedDescription("Priya Raman", "no_bot_token"),
    /^No welcome DM went out, because the bot token \(TASKS_SLACK_BOT_TOKEN\) isn't set here\. Priya gets reminders once it is\.$/,
  );
  assert.match(linkedDescription("Priya Raman", "not_needed"), /no welcome DM/);
});
