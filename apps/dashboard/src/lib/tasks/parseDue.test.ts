import assert from "node:assert/strict";
import { test } from "node:test";

import { bostonToday, describeDue, parseDue } from "./parseDue.ts";

// A Wednesday.
const WED = "2026-11-18";

function cases(today: string, table: Record<string, string | null>) {
  for (const [input, want] of Object.entries(table)) {
    assert.equal(parseDue(input, today), want, `"${input}" on ${today}`);
  }
}

test("the examples in the issue", () => {
  cases(WED, {
    fri: "2026-11-20",
    tomorrow: "2026-11-19",
    "next week": "2026-11-25",
    "+3d": "2026-11-21",
    "2w": "2026-12-02",
    "12/4": "2026-12-04",
    "nov 30": "2026-11-30",
    "30": "2026-11-30",
  });
});

test("today and tomorrow, and their short forms", () => {
  cases(WED, {
    today: WED,
    tod: WED,
    eod: WED,
    tmrw: "2026-11-19",
    tmr: "2026-11-19",
    tom: "2026-11-19",
  });
});

test("weekdays mean the next one coming, never today", () => {
  cases(WED, {
    thu: "2026-11-19",
    thurs: "2026-11-19",
    th: "2026-11-19",
    friday: "2026-11-20",
    "next fri": "2026-11-20",
    "this fri": "2026-11-20",
    sat: "2026-11-21",
    su: "2026-11-22",
    mon: "2026-11-23",
    tues: "2026-11-24",
    tu: "2026-11-24",
    // Said on a Wednesday, "wed" is a week out.
    wed: "2026-11-25",
    "fri.": "2026-11-20",
  });
});

test("end of week is the coming Friday, or today on a Friday", () => {
  cases(WED, { eow: "2026-11-20", "this week": "2026-11-20" });
  cases("2026-11-20", { eow: "2026-11-20", fri: "2026-11-27" });
});

test("relative days and weeks", () => {
  cases(WED, {
    "+0d": WED,
    "3d": "2026-11-21",
    "+ 3d": "2026-11-21",
    "3 days": "2026-11-21",
    "in 3 days": "2026-11-21",
    "1 day": "2026-11-19",
    "+1w": "2026-11-25",
    "2 weeks": "2026-12-02",
    "in 2 weeks": "2026-12-02",
    "in a week": "2026-11-25",
    nw: "2026-11-25",
  });
});

test("month/day picks the next time it comes around", () => {
  cases(WED, {
    "11/18": WED,
    "12-4": "2026-12-04",
    "12.4": "2026-12-04",
    "1/5": "2027-01-05",
    // Earlier this year means next year.
    "11/17": "2027-11-17",
    "3/1": "2027-03-01",
  });
});

test("month/day/year is taken as written", () => {
  cases(WED, {
    "12/4/26": "2026-12-04",
    "12/4/2027": "2027-12-04",
    "1/2/2026": "2026-01-02",
  });
});

test("month names, either order, with or without a suffix", () => {
  cases(WED, {
    "nov 30": "2026-11-30",
    "November 30th": "2026-11-30",
    "nov. 30": "2026-11-30",
    "dec 1st": "2026-12-01",
    "30 nov": "2026-11-30",
    "4th december": "2026-12-04",
    "jan 3": "2027-01-03",
    "Dec 4, 2026": null, // the year form isn't supported; says so instead of guessing
  });
});

test("a bare day of the month", () => {
  cases(WED, {
    "18": WED,
    "30": "2026-11-30",
    "the 30th": "2026-11-30",
    "5": "2026-12-05",
    "5th": "2026-12-05",
  });
});

test("forgiving about case, spaces and a leading 'due'", () => {
  cases(WED, {
    "  FRI  ": "2026-11-20",
    "Next   Week": "2026-11-25",
    "due fri": "2026-11-20",
    "Due 12/4": "2026-12-04",
  });
});

test("typos and impossible dates are null, never a guess", () => {
  cases(WED, {
    "": null,
    "   ": null,
    frii: null,
    fryday: null,
    f: null,
    t: null,
    s: null,
    "nxt week": null,
    "2/30": null,
    "2/30/2027": null,
    "13/1": null,
    "0/5": null,
    "12/0": null,
    "12/32": null,
    "nov 31": null,
    "32": null,
    "0": null,
    // No Nov 31, and jumping to Dec 31 would surprise someone.
    "31": null,
    ma: null,
    "+d": null,
    "1000d": null,
    "next month": null,
    "2026-12-04x": null,
    tbd: null,
    asap: null,
  });
});

test("a bare day that has passed rolls into next month only", () => {
  // Jan 30 has passed and there is no Feb 30.
  cases("2026-01-31", { "30": null, "28": "2026-02-28" });
  cases("2026-12-20", { "5": "2027-01-05" });
});

test("crosses years and leap days", () => {
  cases("2026-12-30", {
    "+3d": "2027-01-02",
    fri: "2027-01-01",
    "1/1": "2027-01-01",
  });
  cases("2028-02-27", { "2/29": "2028-02-29", "+2d": "2028-02-29" });
  // 2027 has no Feb 29.
  cases("2026-03-01", { "2/29": null });
});

test("daylight saving doesn't move a day", () => {
  // Boston springs forward on 2027-03-14 and falls back on 2026-11-01.
  cases("2027-03-13", {
    "+1d": "2027-03-14",
    "+2d": "2027-03-15",
    sun: "2027-03-14",
  });
  cases("2026-10-31", { "+1d": "2026-11-01", "+2d": "2026-11-02" });
});

test("a broken today gives null", () => {
  assert.equal(parseDue("fri", "nope"), null);
  assert.equal(parseDue("fri", "2026-02-30"), null);
});

test("bostonToday is Boston's date, not UTC's", () => {
  // 11:30 PM in Boston on Nov 18 is already Nov 19 in UTC.
  assert.equal(bostonToday(new Date("2026-11-19T04:30:00Z")), "2026-11-18");
  assert.equal(bostonToday(new Date("2026-11-19T05:30:00Z")), "2026-11-19");
  // Summer: UTC-4.
  assert.equal(bostonToday(new Date("2026-07-01T03:59:00Z")), "2026-06-30");
});

test("describeDue shows the date and how far off it is", () => {
  assert.equal(describeDue("2026-11-20", WED), "Fri, Nov 20 · in 2 days");
  assert.equal(describeDue(WED, WED), "Wed, Nov 18 · today");
  assert.equal(describeDue("2026-11-19", WED), "Thu, Nov 19 · tomorrow");
  assert.equal(describeDue("2026-11-17", WED), "Tue, Nov 17 · yesterday");
  assert.equal(describeDue("2026-11-10", WED), "Tue, Nov 10 · 8 days ago");
  assert.equal(describeDue("2027-01-05", WED), "Tue, Jan 5, 2027 · in 48 days");
  assert.equal(describeDue("junk", WED), "");
});
