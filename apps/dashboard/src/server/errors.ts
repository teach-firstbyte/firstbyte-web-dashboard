/**
 * The one error type services throw for *expected* domain failures: a row that
 * is not there, an invariant a write would break, input that got past the type
 * system.
 *
 * DELIBERATELY NOT for infrastructure failures. A dropped connection or a P1001
 * must fly through a service untouched, because that is exactly what the
 * try/catch in OfficerDashboard and both attendance views keys off to set
 * `dbUnavailable` and render their warning banner. Catching it inside a service
 * turns a database outage into a blank page with no warning, which is worse
 * than the crash it replaces.
 *
 * So: NEVER write a try/catch inside src/server/. If you find yourself wanting
 * one, the thing you are catching is either a domain failure -- in which case
 * check for it explicitly and throw a ServiceError -- or it is an outage that
 * belongs to the caller.
 */
export type ServiceErrorCode =
  "INVALID" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT";

const STATUS: Record<ServiceErrorCode, number> = {
  INVALID: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }

  /** The HTTP status this failure maps to. Read by toErrorResponse. */
  get status(): number {
    return STATUS[this.code];
  }
}

/** The shape every server action already returns to its form. */
export type ActionResult = { success?: boolean; error?: string };

/**
 * The server-action counterpart of toErrorResponse.
 *
 * Actions must catch. Next.js scrubs an uncaught throw crossing the action
 * boundary to a generic string in production, so without this the user reads
 * "an error occurred" instead of "You already left feedback for this meeting."
 */
export function toActionError(
  error: unknown,
  context: string,
  fallback: string,
): ActionResult {
  if (error instanceof ServiceError) return { error: error.message };
  console.error(`${context} failed:`, error);
  return { error: fallback };
}
