// Date formatters. The two at the top return `null` rather than a string for
// missing values so DetailField applies its own empty-state styling instead of
// receiving a pre-baked "N/A".
//
// Every formatter pins the club's time zone. Server components format dates
// too, and the server runs in UTC on Vercel, so without this a 7 PM meeting
// would read "11 PM" on any page rendered on the server.

export const CLUB_TIME_ZONE = "America/New_York";

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    timeZone: CLUB_TIME_ZONE,
  });
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    timeZone: CLUB_TIME_ZONE,
  });
}

// The ones below are for lists and cards, where a value is always present.

/** "7:00 PM" */
export function formatTime(value: Date | string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: CLUB_TIME_ZONE,
  });
}

/** "Tue, Oct 13" */
export function formatShortDate(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: CLUB_TIME_ZONE,
  });
}

/** "Tuesday, October 13 at 7:00 PM" */
export function formatLongDateTime(value: Date | string) {
  const d = new Date(value);
  return `${d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: CLUB_TIME_ZONE,
  })} at ${formatTime(d)}`;
}

/** "Tue 7:00 PM" */
export function formatWeekdayTime(value: Date | string) {
  const d = new Date(value);
  const weekday = d.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: CLUB_TIME_ZONE,
  });
  return `${weekday} ${formatTime(d)}`;
}

/** "in 2 hours", "tomorrow", "3 days ago" */
export function formatRelative(value: Date | string, now: number = Date.now()) {
  const diffMs = new Date(value).getTime() - now;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

/** "Oct" and "16" for a calendar-page badge, in the club's time zone. */
export function monthAndDay(value: Date | string) {
  const d = new Date(value);
  return {
    month: d.toLocaleDateString("en-US", {
      month: "short",
      timeZone: CLUB_TIME_ZONE,
    }),
    day: d.toLocaleDateString("en-US", {
      day: "numeric",
      timeZone: CLUB_TIME_ZONE,
    }),
  };
}

/** "October 2026", for grouping past meetings. */
export function formatMonthYear(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: CLUB_TIME_ZONE,
  });
}
