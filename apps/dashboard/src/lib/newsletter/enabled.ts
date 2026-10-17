import "server-only";

import { isPreviewDeployment } from "@/lib/deployment";

/**
 * The newsletter is a prototype. It is on for preview deployments and local
 * development, and off in production until NEWSLETTER_ENABLED=true is set
 * there, so merging this code changes nothing on teachfirstbyte.com.
 */
export function isNewsletterEnabled(): boolean {
  return (
    isPreviewDeployment() ||
    process.env.NODE_ENV === "development" ||
    process.env.NEWSLETTER_ENABLED === "true"
  );
}

/**
 * The "Run draft job now" and "Send now" buttons. Vercel only runs scheduled
 * jobs on production, so previews need these to try the whole flow. Never in
 * production: there, issues go out on the schedule only.
 */
export function canRunJobsByHand(): boolean {
  return isPreviewDeployment() || process.env.NODE_ENV === "development";
}

/**
 * Who an issue may be emailed to. Everywhere except a production deployment
 * that has explicitly been switched on, that is only the comma-separated
 * NEWSLETTER_TEST_RECIPIENTS -- so a preview, which holds real officers'
 * emails, can never email the club.
 */
export function mayEmailMembers(): boolean {
  return (
    !isPreviewDeployment() &&
    process.env.NODE_ENV === "production" &&
    process.env.NEWSLETTER_SEND_TO_MEMBERS === "true"
  );
}

export function testRecipients(): string[] {
  return (process.env.NEWSLETTER_TEST_RECIPIENTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}
