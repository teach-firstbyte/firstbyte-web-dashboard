import { NextResponse } from "next/server";
import type { z } from "zod";
import { ServiceError } from "./errors";

/**
 * The adapter between services and HTTP. The one file under src/server/ allowed
 * to import next/server -- everything else returns data and throws
 * ServiceError, and this turns that into a response.
 */

/**
 * Flattens zod's issue list into the single `{ error: string }` string that
 * every route already returns and every client already reads (MeetingsTable and
 * ApprovalDetailSheet both read `data.error`). A richer shape would mean
 * editing six browser components for no gain.
 */
function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) =>
      i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
    )
    .join("; ");
}

/** Validates already-parsed input. Throws INVALID, which becomes a 400. */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ServiceError("INVALID", formatIssues(result.error));
  }
  return result.data;
}

/**
 * Reads and validates a JSON request body.
 *
 * The inner try/catch is around request.json(), not around a query -- a
 * malformed body is a client error and deserves a 400 with a sentence, where
 * the bare throw would surface as a generic 500.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ServiceError("INVALID", "Request body must be valid JSON");
  }
  return parseOrThrow(schema, raw);
}

/**
 * The single catch every route handler ends with.
 *
 * A ServiceError carries its own status and a message that is safe to show a
 * user. Anything else is a bug or an outage: log it with the route that raised
 * it, and return that route's generic 500 message. This is what collapses the
 * old 400/404/409/500 ladder into one line per handler.
 */
export function toErrorResponse(
  error: unknown,
  route: string,
  fallback: string,
): NextResponse {
  if (error instanceof ServiceError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  console.error(`${route} failed:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
