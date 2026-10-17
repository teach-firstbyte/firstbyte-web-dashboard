"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { withBasePath } from "@/lib/paths";
import { publicOrigin } from "@/lib/publicOrigin";

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim();
  if (!email) {
    redirect("/forgot-password?error=Email is required");
  }

  const origin = await publicOrigin();

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    // Absolute, and prefixed with the zone's base path: this URL lands in the
    // user's inbox and is opened against the public domain, where a bare
    // /auth/confirm would 404.
    //
    // Points at /auth/confirm, NOT /auth/callback. Recovery used to send people
    // straight to the route that spends the token, which made reset strictly
    // worse than signup: signup at least had an inert landing page in front of
    // it, so a scanner had to follow a link to do damage, whereas one plain
    // fetch of this URL killed the reset. Mail security that opens links before
    // delivery therefore broke password reset outright for Northeastern
    // addresses. The interstitial now covers both flows, and the token is only
    // spent by the POST it submits.
    redirectTo: `${origin}${withBasePath("/auth/confirm?next=/reset-password")}`,
  });

  redirect("/forgot-password?sent=1");
}
