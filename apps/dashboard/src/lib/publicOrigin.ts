import "server-only";

import { headers } from "next/headers";

/**
 * The origin a user's browser actually sees, for URLs that leave the app.
 *
 * This app runs as a Multi-Zone behind apps/web, so the request's own `host` and
 * `origin` headers are the dashboard's INTERNAL host (its .vercel.app URL in
 * production). A password-reset link built from those would arrive in someone's
 * inbox pointing at the internal deployment rather than teachfirstbyte.com.
 *
 * NEXT_PUBLIC_APP_URL is the explicit, deterministic answer and must be set to
 * the public origin. The x-forwarded-host fallback covers the case where it is
 * missing, since Next sets that header when proxying to an external rewrite
 * destination.
 *
 * Used by the password-reset email and the newsletter email.
 */
export async function publicOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return h.get("origin") ?? `http://${h.get("host")}`;
}
