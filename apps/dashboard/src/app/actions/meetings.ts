"use server";

import { revalidatePath } from "next/cache";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { type ActionResult, toActionError } from "@/server/errors";
import { parseOrThrow } from "@/server/http";
import { deleteMeeting, updateMeeting } from "@/server/meetings/mutations";
import { updateMeetingSchema } from "@/server/meetings/schema";

/**
 * Updates a meeting's details from the officer dashboard. Bound with the
 * meeting id (`updateMeetingAction.bind(null, meeting.id)`) so the form only
 * needs to submit its own fields.
 *
 * `teamId` and `maxCapacity` come in from the form as "none"/"" for "not
 * set" -- nullableIdParam only treats null/undefined as absent, so both are
 * normalized to null here before validation.
 */
export async function updateMeetingAction(
  meetingId: number,
  prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireOfficer();

  const teamId = formData.get("teamId");
  const maxCapacity = formData.get("maxCapacity");

  try {
    const input = parseOrThrow(updateMeetingSchema, {
      title: formData.get("title"),
      type: formData.get("type"),
      scheduledAt: formData.get("scheduledAt"),
      description: formData.get("description"),
      teamId: !teamId || teamId === "none" ? null : teamId,
      location: formData.get("location"),
      isRequired: formData.get("isRequired") === "on",
      maxCapacity: maxCapacity || null,
    });
    await updateMeeting(meetingId, input);
  } catch (e) {
    return toActionError(e, "updateMeetingAction", "Failed to update meeting");
  }

  revalidatePath("/");
  return { success: true };
}

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
