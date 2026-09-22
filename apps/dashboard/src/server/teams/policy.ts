import type { TeamJoinPolicy } from "@prisma/client";
import { isSuperAdmin } from "@/lib/auth/roles";
import { canAdministerTeam } from "@/lib/auth/teamPolicy";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";

/**
 * The authorization gate for invite-only teams.
 *
 * Six write paths can put someone on a team -- onboarding, assign, decide,
 * remove, edit the team, delete the team -- and every one of them has to apply
 * the same rule. These asserts are where it is written, so a seventh caller
 * inherits it instead of having to remember it. Guarding in the route handlers
 * instead would mean six copies and a hole the first time someone adds a script.
 *
 * FORBIDDEN maps to 403, and both toErrorResponse and toActionError pass the
 * message through verbatim -- so the officer reads the sentence rather than
 * "Failed to update team".
 */
type TeamPolicy = { joinPolicy: TeamJoinPolicy };

/** Adding, removing, approving, rejecting, or promoting on a team. */
export function assertCanManageTeamMembership(
  actor: Viewer,
  team: TeamPolicy,
): void {
  if (!canAdministerTeam(actor, team)) {
    throw new ServiceError(
      "FORBIDDEN",
      "Only a super admin can change who is on an invite-only team.",
    );
  }
}

/**
 * Editing or deleting the team record itself.
 *
 * Deleting is why this covers more than it looks like it needs to: team_member
 * rows cascade, so deleting EBOARD is a strict superset of removing everyone
 * from it.
 */
export function assertCanEditTeam(actor: Viewer, team: TeamPolicy): void {
  if (!canAdministerTeam(actor, team)) {
    throw new ServiceError(
      "FORBIDDEN",
      "Only a super admin can edit an invite-only team.",
    );
  }
}

/**
 * Changing joinPolicy itself, in EITHER direction.
 *
 * assertCanEditTeam already stops a regular officer un-restricting EBOARD -- the
 * team is INVITE_ONLY, so the edit is refused before this field is read. This
 * exists for the other direction, and so that no one has to reason about which
 * check covers which case.
 */
export function assertCanSetJoinPolicy(actor: Viewer): void {
  if (!isSuperAdmin(actor)) {
    throw new ServiceError(
      "FORBIDDEN",
      "Only a super admin can change a team's join policy.",
    );
  }
}
