"use server";

import { revalidatePath } from "next/cache";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { type ActionResult, toActionError } from "@/server/errors";
import { parseOrThrow } from "@/server/http";
import { updateTeam } from "@/server/teams/mutations";
import { updateTeamSchema } from "@/server/teams/schema";

/**
 * Updates a team's name, description, and active status from the officer
 * dashboard. Bound with the team id (`updateTeamAction.bind(null, team.id)`)
 * so the form only needs to submit its own fields.
 */
export async function updateTeamAction(
  teamId: number,
  prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireOfficer();

  try {
    const input = parseOrThrow(updateTeamSchema, {
      name: formData.get("name"),
      description: formData.get("description"),
      isActive: formData.get("isActive") === "on",
    });
    await updateTeam(teamId, input);
  } catch (e) {
    return toActionError(e, "updateTeamAction", "Failed to update team");
  }

  revalidatePath("/");
  return { success: true };
}
