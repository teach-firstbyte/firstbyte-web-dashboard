import { CLUB_TIME_ZONE } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The Monday of the club's week that `now` falls in, as a UTC-midnight Date,
 * which is what a Postgres DATE column round-trips to. "The club's week" is
 * Boston time, so Sunday 11 PM in Boston is still last week even though it is
 * already Monday in UTC.
 */
export function weekOf(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;

  const localMidnight = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
  );
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    get("weekday") ?? "Mon",
  );
  return new Date(localMidnight - weekday * DAY_MS);
}

/**
 * "Oct 12" for a weekOf value. Formatted in UTC on purpose: weekOf is a
 * UTC-midnight date, and in Boston time that instant is still Sunday.
 */
export function formatWeekOf(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

/** The 7 days the draft job reads: everything since a week before `now`. */
export function draftWindowStart(now: Date): Date {
  return new Date(now.getTime() - 7 * DAY_MS);
}

/** "Coming up" in an issue covers the next 14 days from when it is sent. */
export function upcomingWindowEnd(now: Date): Date {
  return new Date(now.getTime() + 14 * DAY_MS);
}

/** How long the home page card is shown after an issue goes out. */
export const HOME_CARD_DAYS = 14;
export function homeCardCutoff(now: Date): Date {
  return new Date(now.getTime() - HOME_CARD_DAYS * DAY_MS);
}
