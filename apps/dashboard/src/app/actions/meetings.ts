"use server";

import { revalidatePath } from "next/cache";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { type ActionResult, toActionError } from "@/server/errors";
import { deleteMeeting } from "@/server/meetings/mutations";

/** Deletes a meeting from the officer dashboard. Attendance and feedback cascade. */
export async function deleteMeetingAction(
  meetingId: number,
): Promise<ActionResult> {
  await requireOfficer();

  try {
    await deleteMeeting(meetingId);
  } catch (e) {
    return toActionError(e, "deleteMeetingAction", "Failed to delete meeting");
  }

  revalidatePath("/");
  return { success: true };
}
