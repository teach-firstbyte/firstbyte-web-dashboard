import { z } from "zod";
import { ServiceError } from "./errors";

/**
 * Shared zod pieces. A domain schema builds from these so that "what counts as
 * a valid id" is answered once.
 *
 * On coercion and null: z.coerce.number() runs Number(x), and Number(null) is
 * 0, so the order of .nullish() matters. Verified against zod 4.4.3 --
 * .nullish() wraps the schema and short-circuits on null and undefined before
 * the inner coercion ever runs, so `{ "teamId": null }` stays null. Keep
 * .nullish() on the OUTSIDE of the coercion chain, which is what these do.
 */

/**
 * A path, query or body value that must be a positive integer id.
 *
 * One message for every way it can fail. Without it a missing field reports
 * "expected number, received NaN" -- z.coerce runs Number(undefined) first --
 * which tells a user nothing. formatIssues prefixes the field name, so this
 * reads as "meetingId: must be a positive whole number".
 */
const ID_MESSAGE = "must be a positive whole number";

export const idParam = z.coerce
  .number({ error: ID_MESSAGE })
  .int(ID_MESSAGE)
  .positive(ID_MESSAGE);

/**
 * An id that may be absent or explicitly null, normalized to null either way.
 *
 * Both spellings reach us: MeetingsTable sends `teamId: null` for a club-wide
 * meeting, while a PATCH body simply omits the field. The service should not
 * have to tell those apart.
 */
export const nullableIdParam = idParam.nullish().transform((v) => v ?? null);

/**
 * Accepts an ISO string or a Date. Rejects anything Date cannot parse.
 *
 * The message is spelled out because zod's default here is unusually poor:
 * z.coerce.date() turns "not-a-date" into an Invalid Date object first, so the
 * default reads "expected date, received Date", which is nonsense to an officer
 * mistyping a form. MeetingsTable prints `data.error` verbatim.
 */
export const dateField = z.coerce.date({ error: "must be a valid date" });

/**
 * Free text that is optional. Trims, and treats "" the same as absent, so a
 * cleared form field stores null rather than an empty string.
 */
export const nullableText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));

/**
 * A route-param id for an API handler. Throws INVALID, which becomes a 400.
 *
 * `label` keeps the message these routes already returned ("Invalid meeting
 * ID"), which is nicer than zod's "expected number, received NaN".
 */
export function requireId(raw: string, label: string): number {
  const result = idParam.safeParse(raw);
  if (!result.success) {
    throw new ServiceError("INVALID", `Invalid ${label} ID`);
  }
  return result.data;
}

/**
 * A route-param id, or null when it is not a usable id.
 *
 * For pages, which render their own "Invalid meeting." line rather than
 * throwing. Route handlers use idParam through parseOrThrow instead, because
 * they need a 400.
 */
export function parseId(raw: string): number | null {
  const result = idParam.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * One value out of Next.js searchParams.
 *
 * Next gives `string | string[] | undefined` because a param can repeat in the
 * query string. Every caller here wants the first value.
 */
export function firstParam(
  raw: string | string[] | undefined,
): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * A page number out of searchParams, for getPagination().
 *
 * Returns NaN for junk on purpose. getPagination already clamps a non-integer
 * to page 1, so `?page=abc` renders page 1 instead of throwing.
 */
export function pageParam(raw: string | string[] | undefined): number {
  return parseInt(firstParam(raw) ?? "");
}

/** A trimmed search term, or undefined when it is missing or blank. */
export function searchParam(
  raw: string | string[] | undefined,
): string | undefined {
  return firstParam(raw)?.trim() || undefined;
}

/**
 * A searchParams value that must belong to an enum, or undefined.
 *
 * Unknown values become undefined rather than an error: a stale bookmark with
 * a removed status should show the unfiltered list, not a crash.
 */
export function enumParam<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  const value = firstParam(raw);
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}
