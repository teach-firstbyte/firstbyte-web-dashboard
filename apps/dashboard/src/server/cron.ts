import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Is this request from Vercel Cron? Vercel sends `Authorization: Bearer
 * <CRON_SECRET>`. Without CRON_SECRET set, every request is refused, so nobody
 * can trigger a job by guessing its URL.
 *
 * Cron jobs (vercel.json) run on the production deployment only. To run one
 * on a preview or locally, send the same header with that deployment's secret.
 */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const sent = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return (
    !!secret &&
    sent.length === expected.length &&
    timingSafeEqual(Buffer.from(sent), Buffer.from(expected))
  );
}
