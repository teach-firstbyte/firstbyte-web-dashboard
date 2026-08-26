import { createClient } from "@/lib/supabase/server";
import { syncUserToDb } from "@/lib/auth/sync-user";
import { NextResponse } from "next/server";
import { EmailOtpType } from "@supabase/supabase-js";
import { safeInternalPath, withBasePath } from "@/lib/paths";

/**
 * Redirect to a path within this zone.
 *
 * Deliberately emits a RELATIVE Location header instead of using
 * NextResponse.redirect(), which requires an absolute URL.
 *
 * This route is reached through apps/web's rewrite, so `new URL(request.url)`
 * reports the dashboard's own internal host (its .vercel.app URL in production),
 * not the public domain. Building an absolute redirect from it ejected users
 * from teachfirstbyte.com onto the raw internal deployment URL partway through
 * login, and leaked that URL publicly.
 *
 * A relative Location is resolved by the browser against the URL it actually
 * requested, so the public origin is preserved without having to trust
 * x-forwarded-* headers.
 *
 * `no-store` because every response here is tied to a single-use token. Nothing
 * about it may be cached by a proxy or a back/forward navigation.
 */
function redirectWithinZone(path: string): NextResponse {
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: withBasePath(path),
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

const INVALID = "/login?error=Authentication link was invalid or expired";

/**
 * Finish a one-time email token and start the session.
 *
 * Shared by both handlers below so the OAuth and email paths cannot drift.
 */
async function consumeToken(
  token_hash: string,
  type: EmailOtpType,
  next: string,
): Promise<NextResponse> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error || !data.user) return redirectWithinZone(INVALID);

  await syncUserToDb(data.user);
  return redirectWithinZone(next);
}

/**
 * OAuth only.
 *
 * This handler used to accept `token_hash` as well, and that was the bug: an
 * emailed link is fetched by things that are not the recipient. Northeastern's
 * mail security (Microsoft Defender) detonates every URL in a message BEFORE
 * delivering it -- it loaded /auth/confirm, followed the plain <a> on that page
 * to this route, and burned the token. Accounts were confirmed before the email
 * reached the inbox, and by the time a member clicked, the link was spent.
 *
 * Email tokens are handled by POST below, because a scanner follows links but
 * does not submit forms. Keeping a GET path for them would leave the hole open.
 *
 * `code` stays on GET because it has no choice: Google redirects the browser
 * here, and a redirect is always a GET. That is acceptable -- the code is bound
 * to a PKCE verifier held in this app's cookie, so a scanner fetching the URL
 * without that cookie cannot exchange it.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next")) ?? "/";

  if (!code) return redirectWithinZone(INVALID);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) return redirectWithinZone(INVALID);

  await syncUserToDb(data.user);
  return redirectWithinZone(next);
}

/**
 * Email confirmation, password recovery, magic link, and email change.
 *
 * Reached only by the form on /auth/confirm. The method is the whole defence:
 * link scanners crawl hrefs, they do not POST forms.
 */
export async function POST(request: Request) {
  const form = await request.formData();

  const token_hash = form.get("token_hash");
  const type = form.get("type");
  const next = safeInternalPath(form.get("next") as string | null) ?? "/";

  if (typeof token_hash !== "string" || typeof type !== "string") {
    return redirectWithinZone(INVALID);
  }

  return consumeToken(token_hash, type as EmailOtpType, next);
}
