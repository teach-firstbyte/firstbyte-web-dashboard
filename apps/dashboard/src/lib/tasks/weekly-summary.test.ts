import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildWeeklySummary,
  DEFAULT_SUMMARY_SCHEDULE,
  hourLabel,
  isSummarySchedule,
  joinNames,
  nextSummary,
  nextSummaryLabel,
  scheduleLabel,
  summaryDueNow,
  summaryDueWording,
  weekdayOf,
  weekOf,
  weeklySummaryMessage,
  type SummaryPerson,
  type SummarySchedule,
  type SummaryTask,
} from "./weekly-summary.ts";

// 2026: daylight saving starts Sunday March 8 and ends Sunday November 1.
// 9am Boston is 13:00 UTC in summer (EDT) and 14:00 UTC in winter (EST).
// Monday November 23 and Monday June 15 2026 are Mondays.

const at = (iso: string) => new Date(iso);
const MONDAY_9 = DEFAULT_SUMMARY_SCHEDULE;
const due = (s: SummarySchedule, iso: string) => summaryDueNow(s, at(iso));

describe("the week", () => {
  test("weekdays count from Sunday, like Date.getDay", () => {
    assert.equal(weekdayOf("2026-11-22"), 0);
    assert.equal(weekdayOf("2026-11-23"), 1);
    assert.equal(weekdayOf("2026-11-28"), 6);
  });

  test("a week is keyed by its Monday, Sunday included", () => {
    assert.equal(weekOf("2026-11-23"), "2026-11-23");
    assert.equal(weekOf("2026-11-25"), "2026-11-23");
    assert.equal(weekOf("2026-11-29"), "2026-11-23");
    assert.equal(weekOf("2026-11-30"), "2026-11-30");
  });

  test("across a month and a year end", () => {
    assert.equal(weekOf("2026-12-02"), "2026-11-30");
    assert.equal(weekOf("2027-01-03"), "2026-12-28");
  });
});

describe("is the summary due now", () => {
  test("Monday 9am Boston by default", () => {
    assert.deepEqual(MONDAY_9, { day: 1, hour: 9 });
    assert.deepEqual(due(MONDAY_9, "2026-11-23T14:00:00Z"), {
      date: "2026-11-23",
      hour: 9,
      weekOf: "2026-11-23",
    });
  });

  test("not a minute before 9am", () => {
    assert.equal(due(MONDAY_9, "2026-11-23T13:59:59Z"), null);
  });

  test("not on other days", () => {
    for (const iso of [
      "2026-11-21T14:00:00Z", // Saturday
      "2026-11-22T20:00:00Z", // Sunday
      "2026-11-25T14:00:00Z", // Wednesday
    ]) {
      assert.equal(due(MONDAY_9, iso), null, iso);
    }
  });

  test("a late run still sends it, until 9am the next day", () => {
    const slot = { date: "2026-11-23", hour: 9, weekOf: "2026-11-23" };
    assert.deepEqual(due(MONDAY_9, "2026-11-23T14:59:00Z"), slot); // 9:59
    assert.deepEqual(due(MONDAY_9, "2026-11-23T20:30:00Z"), slot); // 3:30pm
    assert.deepEqual(due(MONDAY_9, "2026-11-24T04:59:00Z"), slot); // 11:59pm
    assert.deepEqual(due(MONDAY_9, "2026-11-24T13:59:00Z"), slot); // Tue 8:59
    assert.equal(due(MONDAY_9, "2026-11-24T14:00:00Z"), null); // Tue 9:00
  });

  test("a run twice in the hour gets the same slot, so the same key", () => {
    assert.deepEqual(
      due(MONDAY_9, "2026-11-23T14:00:05Z"),
      due(MONDAY_9, "2026-11-23T14:45:00Z"),
    );
  });

  test("summer time: 9am is 13:00 UTC", () => {
    assert.equal(due(MONDAY_9, "2026-06-15T12:59:00Z"), null);
    assert.equal(due(MONDAY_9, "2026-06-15T13:00:00Z")?.date, "2026-06-15");
  });

  test("the Monday after daylight saving ends", () => {
    // Nov 2: 8am EST is 13:00 UTC, which was 9am a week earlier.
    assert.equal(due(MONDAY_9, "2026-11-02T13:00:00Z"), null);
    assert.equal(due(MONDAY_9, "2026-11-02T14:00:00Z")?.date, "2026-11-02");
  });

  test("the Monday after daylight saving starts", () => {
    // Mar 9: 9am EDT is 13:00 UTC, which was 8am a week earlier.
    assert.equal(due(MONDAY_9, "2026-03-09T12:59:00Z"), null);
    assert.equal(due(MONDAY_9, "2026-03-09T13:00:00Z")?.date, "2026-03-09");
  });

  test("an hour that doesn't exist goes out with the first run after it", () => {
    // Sunday March 8, 2am: clocks jump from 1:59 EST to 3:00 EDT.
    const sunday2am = { day: 0, hour: 2 };
    assert.equal(due(sunday2am, "2026-03-08T06:59:00Z"), null); // 1:59 EST
    assert.deepEqual(due(sunday2am, "2026-03-08T07:00:00Z"), {
      date: "2026-03-08",
      hour: 2,
      weekOf: "2026-03-02",
    }); // 3:00 EDT
  });

  test("an hour that happens twice gives one slot, so one summary", () => {
    // Sunday November 1, 1am: first in EDT (05:00 UTC), then in EST (06:00).
    const sunday1am = { day: 0, hour: 1 };
    const first = due(sunday1am, "2026-11-01T05:00:00Z");
    const second = due(sunday1am, "2026-11-01T06:00:00Z");
    assert.deepEqual(first, {
      date: "2026-11-01",
      hour: 1,
      weekOf: "2026-10-26",
    });
    assert.deepEqual(second, first);
  });

  test("a configured day and hour", () => {
    const friday5pm = { day: 5, hour: 17 };
    assert.equal(due(friday5pm, "2026-11-27T21:59:00Z"), null);
    assert.deepEqual(due(friday5pm, "2026-11-27T22:00:00Z"), {
      date: "2026-11-27",
      hour: 17,
      weekOf: "2026-11-23",
    });
    assert.equal(due(friday5pm, "2026-11-23T14:00:00Z"), null); // Monday 9am
  });

  test("a Sunday slot is in the week that started the Monday before", () => {
    const sunday8pm = { day: 0, hour: 20 };
    const slot = { date: "2026-11-29", hour: 20, weekOf: "2026-11-23" };
    assert.deepEqual(due(sunday8pm, "2026-11-30T01:00:00Z"), slot); // Sun 8pm
    // Late, on Monday evening: still last week's.
    assert.deepEqual(due(sunday8pm, "2026-11-30T23:00:00Z"), slot); // Mon 6pm
  });

  test("midnight and 11pm", () => {
    const monday0 = { day: 1, hour: 0 };
    assert.equal(due(monday0, "2026-11-23T04:59:00Z"), null); // Sun 11:59pm
    assert.equal(due(monday0, "2026-11-23T05:00:00Z")?.date, "2026-11-23");
    const monday23 = { day: 1, hour: 23 };
    assert.equal(due(monday23, "2026-11-24T04:00:00Z")?.date, "2026-11-23");
    // Tuesday 10pm is still within a day of Monday 11pm.
    assert.equal(due(monday23, "2026-11-25T03:00:00Z")?.date, "2026-11-23");
    assert.equal(due(monday23, "2026-11-25T04:00:00Z"), null); // Tue 11pm
  });
});

describe("the next summary", () => {
  const next = (s: SummarySchedule, iso: string, last: string | null) =>
    nextSummary(s, at(iso), last);

  test("before it, this week", () => {
    // Saturday Nov 21, noon.
    assert.deepEqual(next(MONDAY_9, "2026-11-21T17:00:00Z", "2026-11-16"), {
      date: "2026-11-23",
      hour: 9,
      weekOf: "2026-11-23",
      now: false,
    });
    // Monday, 8am.
    assert.equal(
      next(MONDAY_9, "2026-11-23T13:00:00Z", "2026-11-16").date,
      "2026-11-23",
    );
  });

  test("due and not recorded: with the next hourly run", () => {
    assert.deepEqual(next(MONDAY_9, "2026-11-23T15:00:00Z", "2026-11-16"), {
      date: "2026-11-23",
      hour: 9,
      weekOf: "2026-11-23",
      now: true,
    });
    assert.equal(next(MONDAY_9, "2026-11-23T15:00:00Z", null).now, true);
  });

  test("sent this week: next week's", () => {
    assert.deepEqual(next(MONDAY_9, "2026-11-23T15:00:00Z", "2026-11-23"), {
      date: "2026-11-30",
      hour: 9,
      weekOf: "2026-11-30",
      now: false,
    });
  });

  test("moved to later in a week that had one: the week after", () => {
    // Sent Monday; on Tuesday someone moves it to Fridays.
    const friday = { day: 5, hour: 9 };
    assert.equal(
      next(friday, "2026-11-24T15:00:00Z", "2026-11-23").date,
      "2026-12-04",
    );
  });

  test("moved to later in a week that hadn't had one: this week", () => {
    const friday = { day: 5, hour: 9 };
    assert.equal(
      next(friday, "2026-11-24T15:00:00Z", "2026-11-16").date,
      "2026-11-27",
    );
  });

  test("moved to an hour already past today: due at once", () => {
    // Monday 8:30am, before the 9am one went out, moved to 8am.
    const monday8 = { day: 1, hour: 8 };
    const n = next(monday8, "2026-11-23T13:30:00Z", "2026-11-16");
    assert.equal(n.now, true);
    assert.equal(n.date, "2026-11-23");
  });

  test("moved to a day that has passed: next week's", () => {
    // Thursday, moved to Mondays.
    assert.equal(
      next(MONDAY_9, "2026-11-26T15:00:00Z", "2026-11-16").date,
      "2026-11-30",
    );
  });

  test("labels", () => {
    assert.equal(
      nextSummaryLabel({
        date: "2026-11-30",
        hour: 9,
        weekOf: "2026-11-30",
        now: false,
      }),
      "Next: Mon, Nov 30 at 9:00 AM.",
    );
    assert.equal(
      nextSummaryLabel({
        date: "2026-11-23",
        hour: 9,
        weekOf: "2026-11-23",
        now: true,
      }),
      "This week's goes out with the next hourly run.",
    );
    assert.equal(scheduleLabel(MONDAY_9), "Mondays at 9:00 AM");
    assert.equal(hourLabel(0), "12:00 AM");
    assert.equal(hourLabel(12), "12:00 PM");
    assert.equal(hourLabel(21), "9:00 PM");
    assert.equal(joinNames(["Maya"]), "Maya");
    assert.equal(joinNames(["Maya", "Daniel"]), "Maya and Daniel");
    assert.equal(joinNames(["Maya", "Daniel", "Sam"]), "Maya, Daniel and Sam");
  });
});

describe("the setting", () => {
  test("a weekday 0-6 and an hour 0-23, whole numbers", () => {
    assert.equal(isSummarySchedule({ day: 0, hour: 0 }), true);
    assert.equal(isSummarySchedule({ day: 6, hour: 23 }), true);
    for (const bad of [
      { day: 7, hour: 9 },
      { day: -1, hour: 9 },
      { day: 1, hour: 24 },
      { day: 1.5, hour: 9 },
      { day: "1", hour: 9 },
      { day: 1, hour: null },
    ]) {
      assert.equal(isSummarySchedule(bad), false, JSON.stringify(bad));
    }
  });
});

// ---------------------------------------------------------------------------
// What it says

const TODAY = "2026-11-23"; // a Monday
const URL = "https://example.org/dashboard/tasks";

let nextId = 1;
function task(over: Partial<SummaryTask> = {}): SummaryTask {
  return {
    id: nextId++,
    title: "A task",
    status: "TODO",
    dueDate: TODAY,
    ownerId: 1,
    ownerName: "Priya Nair",
    needsNewOwner: false,
    ...over,
  };
}

const PRIYA: SummaryPerson = {
  id: 1,
  name: "Priya Nair",
  slackConnected: true,
};
const JORDAN: SummaryPerson = {
  id: 2,
  name: "Jordan Lee",
  slackConnected: true,
};

describe("building the summary", () => {
  test("an empty week", () => {
    const summary = buildWeeklySummary({
      tasks: [],
      eboard: [PRIYA, JORDAN],
      today: TODAY,
    });
    assert.deepEqual(summary, {
      date: TODAY,
      counts: { overdue: 0, dueThisWeek: 0, open: 0 },
      people: [],
      needsNewOwner: [],
      notConnected: [],
    });
    assert.equal(
      weeklySummaryMessage(summary, URL).text,
      [
        "*Weekly task summary · Mon, Nov 23*",
        "0 overdue · 0 due this week · 0 open",
        "",
        "Nothing is overdue or due this week.",
        "",
        `<${URL}|Open in dashboard>`,
      ].join("\n"),
    );
  });

  test("only tasks later than this week, or Done: still nothing to list", () => {
    const summary = buildWeeklySummary({
      tasks: [
        task({ dueDate: "2026-11-30" }),
        task({ dueDate: "2026-11-20", status: "DONE" }),
      ],
      eboard: [PRIYA],
      today: TODAY,
    });
    assert.deepEqual(summary.counts, { overdue: 0, dueThisWeek: 0, open: 1 });
    assert.deepEqual(summary.people, []);
    assert.match(
      weeklySummaryMessage(summary, URL).text,
      /Nothing is overdue or due this week\./,
    );
  });

  test("overdue and the next 7 days, by person, soonest first", () => {
    const summary = buildWeeklySummary({
      tasks: [
        task({ id: 10, title: "Slides", dueDate: "2026-11-26" }),
        task({ id: 11, title: "Book room", dueDate: "2026-11-21" }),
        task({
          id: 12,
          title: "Snacks",
          dueDate: TODAY,
          status: "IN_PROGRESS",
        }),
        task({ id: 13, title: "Sunday thing", dueDate: "2026-11-29" }), // +6
        task({ id: 14, title: "Next Monday", dueDate: "2026-11-30" }), // +7
        task({
          id: 15,
          title: "Judges",
          dueDate: "2026-11-24",
          ownerId: 2,
          ownerName: "Jordan Lee",
        }),
        task({ id: 16, title: "Done one", dueDate: TODAY, status: "DONE" }),
      ],
      eboard: [PRIYA, JORDAN],
      today: TODAY,
    });
    assert.deepEqual(summary.counts, { overdue: 1, dueThisWeek: 4, open: 6 });
    assert.deepEqual(summary.people, [
      {
        ownerId: 2,
        name: "Jordan Lee",
        tasks: [{ id: 15, title: "Judges", due: "due tomorrow" }],
      },
      {
        ownerId: 1,
        name: "Priya Nair",
        tasks: [
          { id: 11, title: "Book room", due: "2 days overdue" },
          { id: 12, title: "Snacks", due: "due today" },
          { id: 10, title: "Slides", due: "due Thu" },
          { id: 13, title: "Sunday thing", due: "due Sun" },
        ],
      },
    ]);
  });

  test("tasks that need a new owner, whatever their date, not under anyone", () => {
    const summary = buildWeeklySummary({
      tasks: [
        task({
          id: 20,
          title: "Count kits",
          dueDate: "2026-12-04",
          ownerId: 9,
          ownerName: "Alex Kim",
          needsNewOwner: true,
        }),
        task({
          id: 21,
          title: "Old thing",
          dueDate: "2026-11-20",
          ownerId: 8,
          ownerName: "Former member",
          needsNewOwner: true,
        }),
        task({
          id: 22,
          title: "Finished",
          ownerId: 9,
          ownerName: "Alex Kim",
          needsNewOwner: true,
          status: "DONE",
        }),
      ],
      eboard: [PRIYA],
      today: TODAY,
    });
    assert.deepEqual(summary.people, []);
    assert.deepEqual(summary.needsNewOwner, [
      {
        id: 21,
        title: "Old thing",
        due: "3 days overdue",
        formerOwner: "Former member",
      },
      {
        id: 20,
        title: "Count kits",
        due: "due Fri, Dec 4",
        formerOwner: "Alex Kim",
      },
    ]);
    assert.deepEqual(summary.counts, { overdue: 1, dueThisWeek: 0, open: 2 });
  });

  test("e-board members not connected to Slack, by name", () => {
    const summary = buildWeeklySummary({
      tasks: [],
      eboard: [
        PRIYA,
        { id: 3, name: "Sam Ortiz", slackConnected: false },
        { id: 4, name: "alex Kim", slackConnected: false },
      ],
      today: TODAY,
    });
    assert.deepEqual(summary.notConnected, ["alex Kim", "Sam Ortiz"]);
  });

  test("the whole DM, like the mockup", () => {
    const summary = buildWeeklySummary({
      tasks: [
        task({ title: "Book Curry 340", dueDate: "2026-11-21" }),
        task({ title: "Order snacks", dueDate: TODAY }),
        task({
          title: "Count robotics kits",
          dueDate: "2026-11-27",
          ownerId: 9,
          ownerName: "Alex Kim",
          needsNewOwner: true,
        }),
      ],
      eboard: [PRIYA, { id: 3, name: "Sam Ortiz", slackConnected: false }],
      today: TODAY,
    });
    assert.equal(
      weeklySummaryMessage(summary, URL).text,
      [
        "*Weekly task summary · Mon, Nov 23*",
        "1 overdue · 2 due this week · 3 open",
        "",
        "*Overdue or due this week*",
        "• *Priya Nair*: Book Curry 340 (2 days overdue); Order snacks (due today)",
        "",
        "*Needs a new owner*",
        "• Count robotics kits (was Alex Kim's, due Fri)",
        "",
        "*Not connected to Slack*",
        "• Sam Ortiz won't get reminders until Hector links their account.",
        "",
        `<${URL}|Open in dashboard>`,
      ].join("\n"),
    );
  });

  test("anything a person typed is escaped", () => {
    const summary = buildWeeklySummary({
      tasks: [
        task({ title: "<!channel> & co", ownerName: "<@U123>" }),
        task({
          title: "<b>",
          ownerId: 9,
          ownerName: "A & B",
          needsNewOwner: true,
        }),
      ],
      eboard: [{ id: 3, name: "<!here>", slackConnected: false }],
      today: TODAY,
    });
    const text = weeklySummaryMessage(summary, URL).text;
    assert.doesNotMatch(text, /<!channel>|<@U123>|<!here>|<b>/);
    assert.match(text, /&lt;!channel&gt; &amp; co/);
    assert.match(text, /\*&lt;@U123&gt;\*/);
    assert.match(text, /was A &amp; B's/);
    assert.match(text, /• &lt;!here&gt; won't get reminders/);
  });

  test("built late, it counts from the day it's built", () => {
    // Monday's summary, recorded by a late run on Tuesday morning.
    const summary = buildWeeklySummary({
      tasks: [task({ dueDate: TODAY })],
      eboard: [PRIYA],
      today: "2026-11-24",
    });
    assert.equal(summary.date, "2026-11-24");
    assert.equal(summary.people[0].tasks[0].due, "1 day overdue");
    assert.match(
      weeklySummaryMessage(summary, URL).text,
      /^\*Weekly task summary · Tue, Nov 24\*/,
    );
  });
});

test("due wording", () => {
  const w = (d: string) => summaryDueWording(d, TODAY);
  assert.equal(w("2026-11-22"), "1 day overdue");
  assert.equal(w("2026-11-13"), "10 days overdue");
  assert.equal(w(TODAY), "due today");
  assert.equal(w("2026-11-24"), "due tomorrow");
  assert.equal(w("2026-11-25"), "due Wed");
  assert.equal(w("2026-11-29"), "due Sun");
  assert.equal(w("2026-11-30"), "due Mon, Nov 30");
});
