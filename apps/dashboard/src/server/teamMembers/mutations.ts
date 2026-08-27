import { TeamMemberStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { getUserById } from "@/server/users/queries";
import { getTeamById } from "@/server/teams/queries";
import { assertCanManageTeamMembership } from "@/server/teams/policy";
import type { Viewer } from "@/server/viewer";
import { findMembership, getTeamMemberById } from "./queries";
import type { AssignTeamMemberInput, UpdateTeamMemberInput } from "./schema";

/**
 * Puts a user on a team, whether or not they asked to be there.
 *
 * The three existing-row cases are the subtle part, and they are why this is
 * not a plain create:
 *
 *   APPROVED -> a genuine conflict, they are already on the team
 *   PENDING  -> they asked to join and the officer is now assigning them.
 *               That IS the approval. Rejecting it with a 409 would block the
 *               officer from acting on the very request they are answering.
 *   REJECTED -> the same reversal, in the other direction.
 *
 * Status is set explicitly rather than leaning on the schema default, so this
 * path does not silently change meaning if that default is ever flipped.
 */
export async function assignTeamMember(
  officer: Viewer,
  input: AssignTeamMemberInput,
) {
  // Checked up front so a bad id is a sentence rather than a foreign-key error
  // surfacing as "Failed to create team member".
  await getUserById(input.userId);
  const team = await getTeamById(input.teamId);

  // Before the CONFLICT check below, not after: a non-super-admin must not be
  // able to learn who is already on an invite-only team by reading a 409.
  assertCanManageTeamMembership(officer, team);

  const existing = await findMembership(input.userId, input.teamId);

  if (existing?.status === TeamMemberStatus.APPROVED) {
    throw new ServiceError(
      "CONFLICT",
      "This user is already a member of this team",
    );
  }

  const decision = {
    role: input.role,
    status: TeamMemberStatus.APPROVED,
    decidedAt: new Date(),
    decidedById: officer.id,
  };

  if (existing) {
    const approved = await prisma.teamMember.update({
      where: { id: existing.id },
      data: decision,
    });
    return { membership: approved, created: false };
  }

  const created = await prisma.teamMember.create({
    data: { userId: input.userId, teamId: input.teamId, ...decision },
  });
  return { membership: created, created: true };
}

/**
 * Decides a join request, or promotes a member to lead.
 *
 * Moving a row back to PENDING clears the decision rather than leaving a stale
 * officer and timestamp on it, which would read as though somebody had decided.
 * A role-only change leaves the decision fields untouched, because promoting a
 * member is not a decision about their membership.
 */
export async function updateTeamMember(
  officer: Viewer,
  teamMemberId: number,
  input: UpdateTeamMemberInput,
) {
  const member = await getTeamMemberById(teamMemberId);

  // Gated whichever field is being written. Promoting someone to LEAD of the
  // e-board is an authority change as much as adding them to it is, and
  // splitting the rule ("status restricted, role not") would double it for no
  // benefit.
  assertCanManageTeamMembership(officer, member.team);

  const decided =
    input.status !== undefined && input.status !== TeamMemberStatus.PENDING;

  return prisma.teamMember.update({
    where: { id: teamMemberId },
    data: {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.status !== undefined
        ? {
            status: input.status,
            decidedAt: decided ? new Date() : null,
            decidedById: decided ? officer.id : null,
          }
        : {}),
    },
  });
}

/**
 * Removes a membership outright. Throws NOT_FOUND.
 *
 * Takes the officer purely to authorize the removal, which is why the signature
 * changed: this is the path the Assign Teams modal fires on an unchecked box, so
 * leaving it open would let any officer take the president off the e-board --
 * and would turn hiding the checkbox in the UI into a way to lose data rather
 * than a way to prevent it.
 */
export async function deleteTeamMember(officer: Viewer, teamMemberId: number) {
  const member = await getTeamMemberById(teamMemberId);
  assertCanManageTeamMembership(officer, member.team);
  await prisma.teamMember.delete({ where: { id: teamMemberId } });
  return member;
}
