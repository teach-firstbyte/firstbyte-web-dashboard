"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Send the confirmation email again.
 *
 * Needed because a confirmation link is not always usable by the time it
 * reaches its recipient: Northeastern's mail security opens every URL in a
 * message before delivering it, and any link it follows is spent. The POST-gated
 * /auth/confirm page stops the token being burned that way, but anyone holding
 * an already-dead link from before that fix -- or who simply never got the mail
 * -- needs a way out that is not "sign up again".
 *
 * No emailRedirectTo is passed, deliberately. `resend` reuses the same template
 * as the original signup, and signUp() does not set one either; supplying a
 * value here that is not in the project's allowed redirect list would make
 * GoTrue silently fall back to site_url and send a subtly different link than
 * the one that already works.
 */
export async function resendConfirmation(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim();

  if (!email) {
    redirect("/check-email?error=Enter the email you signed up with");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  const params = new URLSearchParams({ email });

  if (error) {
    // Supabase rate-limits resends (one per minute by default). That arrives as
    // an ordinary error, and its message is the useful thing to show -- it names
    // the wait. Anything else is surfaced as-is rather than swallowed, so a
    // misconfigured template does not look like a silent success.
    params.set("error", error.message);
    redirect(`/check-email?${params.toString()}`);
  }

  params.set("resent", "1");
  redirect(`/check-email?${params.toString()}`);
}
