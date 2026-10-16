import { TeamJoinPolicy, TeamMemberStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { isSuperAdmin } from "@/lib/auth/roles";
import { getUserById } from "@/server/users/queries";
import { getTeamById } from "@/server/teams/queries";
import { JOINABLE_TEAM_WHERE } from "@/server/teams/select";
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
 * Approves every pending team request for a user in one write.
 *
 * Exists for bulk account approval: checking off several signups and
 * approving them at once has no per-row moment to decide each team request,
 * so approving the account approves what they asked for too rather than
 * leaving every request stuck in the queue. Memberships already decided
 * (approved or rejected) are left untouched -- this only fills the gap a bulk
 * approval would otherwise leave, it does not re-open settled requests.
 *
 * Invite-only requests are excluded unless the officer is a super admin, the
 * same rule assertCanManageTeamMembership enforces one row at a time -- a
 * bulk approval must not become a back door onto the e-board for an officer
 * who could not add that person to it directly. Those requests are simply
 * left PENDING rather than erroring, since the account approval this rides
 * along with should still go through.
 */
export async function approvePendingMemberships(
  officer: Viewer,
  userId: number,
) {
  return prisma.teamMember.updateMany({
    where: {
      userId,
      status: TeamMemberStatus.PENDING,
      ...(isSuperAdmin(officer)
        ? {}
        : { team: { joinPolicy: TeamJoinPolicy.OPEN } }),
    },
    data: {
      status: TeamMemberStatus.APPROVED,
      decidedAt: new Date(),
      decidedById: officer.id,
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

/**
 * A member asks to join a team from their Settings page.
 *
 * Only JOINABLE teams (active and open), the same rule onboarding applies, so
 * invite-only teams stay a super admin's to hand out. An existing row decides
 * the rest:
 *
 *   APPROVED -> already on it
 *   PENDING  -> already asked; a second row would break @@unique anyway
 *   REJECTED -> asking again is allowed. The row goes back to PENDING with the
 *               old decision cleared, so it lands in the officer queue as a
 *               fresh request rather than looking already decided.
 */
export async function requestToJoinTeam(viewer: Viewer, teamId: number) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, ...JOINABLE_TEAM_WHERE },
    select: { id: true, name: true },
  });
  if (!team) {
    throw new ServiceError("INVALID", "That team isn't taking join requests.");
  }

  const existing = await findMembership(viewer.id, teamId);
  if (existing?.status === TeamMemberStatus.APPROVED) {
    throw new ServiceError("CONFLICT", `You're already on ${team.name}.`);
  }
  if (existing?.status === TeamMemberStatus.PENDING) {
    throw new ServiceError(
      "CONFLICT",
      `You've already asked to join ${team.name}.`,
    );
  }

  if (existing) {
    return prisma.teamMember.update({
      where: { id: existing.id },
      data: {
        status: TeamMemberStatus.PENDING,
        decidedAt: null,
        decidedById: null,
      },
    });
  }

  return prisma.teamMember.create({
    data: { userId: viewer.id, teamId, status: TeamMemberStatus.PENDING },
  });
}

/**
 * A member cancels their own join request, or leaves a team they're on.
 *
 * Someone else's membership answers NOT_FOUND, the same as one that does not
 * exist, so the id can't be used to probe who is on which team. Invite-only
 * teams are refused: a super admin put them there, so a super admin takes them
 * off. A REJECTED row is left alone, since deleting it would quietly erase an
 * officer's decision.
 */
export async function withdrawFromTeam(viewer: Viewer, teamMemberId: number) {
  const member = await getTeamMemberById(teamMemberId);
  if (member.userId !== viewer.id) {
    throw new ServiceError("NOT_FOUND", "Team member not found");
  }
  if (member.team.joinPolicy === TeamJoinPolicy.INVITE_ONLY) {
    throw new ServiceError(
      "FORBIDDEN",
      "Ask a super admin to take you off an invite-only team.",
    );
  }
  if (member.status === TeamMemberStatus.REJECTED) {
    throw new ServiceError("INVALID", "That request was already declined.");
  }

  await prisma.teamMember.delete({ where: { id: teamMemberId } });
  return { status: member.status, teamName: member.team.name };
}
