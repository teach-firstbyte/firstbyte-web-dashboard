/**
 * Reads a due date the way people say it in a meeting: "fri", "tomorrow",
 * "next week", "+3d", "2w", "12/4", "nov 30", "30".
 *
 * Shared by the meeting page's Action items (#134) and the board's New task
 * form (#135). Pure and import-light, so `node --test` loads it as it is.
 *
 * Every date is a plain calendar day, "YYYY-MM-DD", and "today" is today in
 * Boston (the club's time zone), never the browser's or the server's. The math
 * runs on UTC midnights, where every day is exactly 24 hours long, so a
 * daylight-saving change can't shift a result by a day.
 *
 * The hint under the field (describeDue) always shows the exact date picked,
 * so the room can see what "fri" turned into and fix it on the spot.
 */
import { formatIsoDate } from "../format.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const TODAY_WORDS = ["today", "tod", "tdy", "tonight", "eod"];
const TOMORROW_WORDS = ["tomorrow", "tmrw", "tmr", "tom", "tmw"];
const NEXT_WEEK_WORDS = ["next week", "nw", "in a week", "a week"];
const END_OF_WEEK_WORDS = ["eow", "end of week", "this week"];

/** Today in Boston, as "YYYY-MM-DD". */
export function bostonToday(now: Date = new Date()): string {
  return formatIsoDate(now);
}

/**
 * The date `raw` means, as "YYYY-MM-DD", or null if it can't be read.
 *
 * `today` is "YYYY-MM-DD" in Boston. Tests pass it in; callers leave it out.
 *
 * Bare dates ("12/4", "nov 30", "30") mean the next time that day comes
 * around, today included. A date with a year ("12/4/26") is taken as written,
 * even if it has passed.
 */
export function parseDue(
  raw: string,
  today: string = bostonToday(),
): string | null {
  const base = fromIso(today);
  if (base === null) return null;

  const s = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^due /, "")
    .replace(/,/g, "");
  if (!s) return null;

  const out = (d: Date | null) => (d === null ? null : toIso(d));
  let m: RegExpMatchArray | null;

  if (TODAY_WORDS.includes(s)) return out(base);
  if (TOMORROW_WORDS.includes(s)) return out(addDays(base, 1));
  if (NEXT_WEEK_WORDS.includes(s)) return out(addDays(base, 7));
  if (END_OF_WEEK_WORDS.includes(s)) {
    // The coming Friday, or today if it is Friday.
    return out(addDays(base, (5 - base.getUTCDay() + 7) % 7));
  }

  // "+3d", "3d", "3 days", "in 3 days"
  if ((m = s.match(/^(?:\+ ?|in )?(\d{1,3}) ?(?:d|day|days)$/))) {
    return out(addDays(base, Number(m[1])));
  }
  // "+2w", "2w", "2 weeks", "in 2 weeks"
  if ((m = s.match(/^(?:\+ ?|in )?(\d{1,2}) ?(?:w|wk|wks|week|weeks)$/))) {
    return out(addDays(base, 7 * Number(m[1])));
  }

  // "fri", "friday", "next fri", "this fri"
  if ((m = s.match(/^(?:next |this )?([a-z]+)\.?$/))) {
    const wd = weekdayIndex(m[1]);
    if (wd >= 0) {
      // "fri" and "next fri" both mean the coming Friday. Said on a Friday,
      // that is a week from today: nobody assigns "fri" meaning tonight.
      const ahead = (wd - base.getUTCDay() + 7) % 7 || 7;
      return out(addDays(base, ahead));
    }
  }

  // "12/4", "12-4", "12.4", "12/4/26", "12/4/2026"
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/))) {
    const month = Number(m[1]) - 1;
    const day = Number(m[2]);
    if (m[3]) {
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return out(makeDate(year, month, day));
    }
    return out(nextMonthDay(base, month, day));
  }

  // "nov 30", "november 30th", "nov. 30"
  if ((m = s.match(/^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?$/))) {
    const month = monthIndex(m[1]);
    if (month >= 0) return out(nextMonthDay(base, month, Number(m[2])));
  }
  // "30 nov", "30th november"
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.?$/))) {
    const month = monthIndex(m[2]);
    if (month >= 0) return out(nextMonthDay(base, month, Number(m[1])));
  }

  // "30", "the 30th": that day this month, or next month if it has passed.
  if ((m = s.match(/^(?:the )?(\d{1,2})(?:st|nd|rd|th)?$/))) {
    const day = Number(m[1]);
    const year = base.getUTCFullYear();
    const month = base.getUTCMonth();
    const thisMonth = makeDate(year, month, day);
    if (thisMonth !== null && thisMonth >= base) return out(thisMonth);
    // Only the very next month: "31" on Nov 18 has no Nov 31, and skipping
    // ahead to Dec 31 would be a surprise. Unreadable beats wrong.
    if (thisMonth === null) return null;
    return out(
      month === 11
        ? makeDate(year + 1, 0, day)
        : makeDate(year, month + 1, day),
    );
  }

  return null;
}

/**
 * The hint under a due field: "Fri, Nov 20 · in 2 days".
 * `iso` is a parseDue result; `today` as in parseDue.
 */
export function describeDue(iso: string, today: string = bostonToday()) {
  const d = fromIso(iso);
  const base = fromIso(today);
  if (d === null || base === null) return "";
  const label = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    // Shown with the year only when it isn't this year, so "12/4/27" can't be
    // mistaken for this December.
    ...(d.getUTCFullYear() !== base.getUTCFullYear()
      ? { year: "numeric" as const }
      : {}),
    timeZone: "UTC",
  });
  return `${label} · ${inWords(Math.round((d.getTime() - base.getTime()) / DAY_MS))}`;
}

/** What to tell someone whose date couldn't be read. */
export const DUE_HELP = "Try fri, tomorrow, next week, +3d, 12/4 or nov 30";

function inWords(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

function weekdayIndex(word: string) {
  if (word === "tues") return 2;
  if (word === "thur" || word === "thurs") return 4;
  // One letter is ambiguous ("t", "s"). Two settle every day: "tu", "th",
  // "sa", "su".
  if (word.length < 2) return -1;
  return WEEKDAYS.findIndex((w) => w.startsWith(word));
}

function monthIndex(word: string) {
  // Three letters at least: "ma" could be March or May.
  return word.length < 3 ? -1 : MONTHS.findIndex((m) => m.startsWith(word));
}

/** That month and day, this year if it hasn't passed, otherwise next year. */
function nextMonthDay(base: Date, month: number, day: number) {
  const year = base.getUTCFullYear();
  const thisYear = makeDate(year, month, day);
  if (thisYear !== null && thisYear >= base) return thisYear;
  // Feb 29 asked for in a year that has one, after it's passed, is next
  // year's "no such day": null rather than rolling over to Mar 1.
  return makeDate(year + 1, month, day);
}

/** A UTC midnight, or null if the day doesn't exist (Feb 30, month 13). */
function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month, day));
  return d.getUTCMonth() === month && d.getUTCDate() === day ? d : null;
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY_MS);
}

function fromIso(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? makeDate(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}
