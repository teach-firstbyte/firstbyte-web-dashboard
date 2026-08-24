"use server";

import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { type ActionResult, toActionError } from "@/server/errors";
import { createFeedback } from "@/server/feedback/mutations";
import { createFeedbackSchema } from "@/server/feedback/schema";
import { parseOrThrow } from "@/server/http";

export async function submitFeedback(
  prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireApprovedUser();

  try {
    const input = parseOrThrow(
      createFeedbackSchema,
      Object.fromEntries(formData),
    );
    await createFeedback(user, input);
    return { success: true };
  } catch (e) {
    // Must catch. Next.js scrubs an uncaught throw crossing the action boundary
    // to a generic string in production, so "You've already left feedback for
    // this meeting." would reach the user as "an error occurred".
    return toActionError(e, "submitFeedback", "Failed to submit feedback");
  }
}
