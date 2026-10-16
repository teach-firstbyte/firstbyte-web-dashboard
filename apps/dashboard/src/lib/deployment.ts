import "server-only";

/**
 * Whether this is a Vercel preview deployment (any branch except main).
 *
 * Previews use their own Supabase project, whose Google sign-in is not set
 * up, so features tied to production-only settings check this. Read at
 * request time from Vercel's VERCEL_ENV, so it is false locally and in
 * production.
 */
export function isPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}
