"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSignedInUser } from "@/lib/auth/requireApprovedUser";
import { type ActionResult, toActionError } from "@/server/errors";
import { parseOrThrow } from "@/server/http";
// Aliased: the exported action keeps the name OnboardingForm already
// imports, and the service it calls has the same one.
import { saveOnboarding as persistOnboarding } from "@/server/onboarding/mutations";
import {
  onboardingFormToInput,
  onboardingIntent,
  onboardingSchema,
} from "@/server/onboarding/schema";

export async function saveOnboarding(
  prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSignedInUser("/onboarding");
  const intent = onboardingIntent(formData);

  try {
    const input = parseOrThrow(
      onboardingSchema,
      onboardingFormToInput(formData),
    );
    await persistOnboarding(user, input, intent);
  } catch (e) {
    // Must catch, and must catch HERE rather than around the redirect below.
    // Next.js scrubs an uncaught throw crossing the action boundary to a
    // generic string in production, so "An officer has already reviewed your
    // account." would reach the user as "an error occurred".
    return toActionError(
      e,
      "saveOnboarding",
      "Could not save your submission. Try again.",
    );
  }

  revalidatePath("/onboarding");
  revalidatePath("/pending");

  // Outside the try/catch and outside the transaction: redirect() works by
  // throwing NEXT_REDIRECT, so a catch would swallow it and a transaction
  // would roll back.
  if (intent === "submit") redirect("/pending");

  return { success: true };
}
