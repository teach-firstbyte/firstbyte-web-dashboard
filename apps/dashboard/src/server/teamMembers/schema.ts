import { TeamMemberStatus, TeamRole } from "@prisma/client";
import { z } from "zod";
import { idParam } from "@/server/validation";

const role = z.enum(TeamRole, {
  error: `Invalid role. Must be one of: ${Object.values(TeamRole).join(", ")}`,
});

const status = z.enum(TeamMemberStatus, {
  error: `Invalid status. Must be one of: ${Object.values(TeamMemberStatus).join(", ")}`,
});

export const assignTeamMemberSchema = z.object({
  userId: idParam,
  teamId: idParam,
  role,
});

export type AssignTeamMemberInput = z.infer<typeof assignTeamMemberSchema>;

/**
 * Role and status are both optional, but at least one must be present. One
 * endpoint rather than two, so approving, rejecting, reversing a decision and
 * promoting a member to lead all go through the same place.
 */
export const updateTeamMemberSchema = z
  .object({ role, status })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "role or status is required");

export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberSchema>;
