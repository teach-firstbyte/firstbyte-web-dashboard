"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, toActionError } from "@/server/errors";
import { parseOrThrow } from "@/server/http";
import {
  deleteOwnAccount,
  updateProfileByEmail,
} from "@/server/users/mutations";
import {
  deleteAccountSchema,
  updateProfileSchema,
} from "@/server/users/schema";
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
 * Delete your own account, then sign out.
 *
 * The order is deliberate:
 *   1. Create the admin client. A missing key stops here, before anything
 *      changes.
 *   2. Anonymize the row (deleteOwnAccount). This frees the email.
 *   3. Sign out, so this browser has no session left.
 *   4. Remove the Supabase login, so the old password or Google sign-in no
 *      longer works.
 *
 * Doing 4 before 2 would be worse if 2 then failed: the row would keep the
 * real email, and signing up again would bring back the old account. If 4
 * fails after 2, the person is still out of the old account -- the next
 * sign-in creates a new, empty one through syncUserToDb -- so it is logged
 * rather than shown to someone who is already signed out.
 */
export async function deleteAccount(
  prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await requireApprovedUser("/settings");
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { error: "Not authenticated" };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
    const input = parseOrThrow(deleteAccountSchema, {
      confirmEmail: formData.get("confirmEmail"),
    });
    await deleteOwnAccount(viewer, input);
  } catch (e) {
    return toActionError(e, "deleteAccount", "Failed to delete your account");
  }

  await supabase.auth.signOut();

  const { error } = await admin.auth.admin.deleteUser(authUser.id);
  if (error) {
    console.error(
      `deleteAccount: user ${viewer.id} was anonymized, but removing their Supabase login failed:`,
      error,
    );
  }

  redirect("/login?deleted=1");
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
