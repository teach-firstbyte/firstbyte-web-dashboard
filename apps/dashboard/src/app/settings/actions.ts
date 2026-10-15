"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, toActionError } from "@/server/errors";
import { parseOrThrow } from "@/server/http";
import { updateProfileByEmail } from "@/server/users/mutations";
import { updateProfileSchema } from "@/server/users/schema";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import {
  requestToJoinTeam,
  withdrawFromTeam,
} from "@/server/teamMembers/mutations";
import { idParam } from "@/server/validation";

export async function updateProfile(
  prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not authenticated" };

  try {
    const input = parseOrThrow(updateProfileSchema, {
      name: formData.get("name"),
      preferredName: formData.get("preferredName"),
      pronouns: formData.get("pronouns"),
      gradYear: formData.get("gradYear"),
      major: formData.get("major"),
    });

    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: input.name },
    });
    if (authError) return { error: authError.message };

    await updateProfileByEmail(user.email, input);
  } catch (e) {
    return toActionError(e, "updateProfile", "Failed to update profile");
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function updatePassword(
  prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!(currentPassword && newPassword && confirmPassword)) {
    return { error: "All fields are required." };
  } else if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match." };
  } else if (newPassword.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not authenticated" };

  const { error } = await supabase.auth.updateUser({
    current_password: currentPassword,
    password: newPassword,
  });
  if (error) return { error: error.message };

  return { success: true };
}

/**
 * Ask to join a team from Settings. The rules (open teams only, no duplicate
 * requests) live in requestToJoinTeam; this only authenticates and validates
 * the id.
 */
export async function requestTeamAction(teamId: number): Promise<ActionResult> {
  const viewer = await requireApprovedUser("/settings");
  try {
    await requestToJoinTeam(viewer, parseOrThrow(idParam, teamId));
  } catch (e) {
    return toActionError(e, "requestTeamAction", "Failed to send the request");
  }
  revalidatePath("/settings");
  return { success: true };
}

/** Cancel your own join request, or leave a team you're on. */
export async function withdrawTeamAction(
  membershipId: number,
): Promise<ActionResult> {
  const viewer = await requireApprovedUser("/settings");
  try {
    await withdrawFromTeam(viewer, parseOrThrow(idParam, membershipId));
  } catch (e) {
    return toActionError(
      e,
      "withdrawTeamAction",
      "Failed to update your teams",
    );
  }
  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}
