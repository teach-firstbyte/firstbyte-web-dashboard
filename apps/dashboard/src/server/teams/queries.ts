import { TeamMemberStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { teamWithMembersArgs, type TeamWithMembers } from "./select";

/**
 * The teams a user actually belongs to.
 *
 * APPROVED only, and that filter is the whole point of this function. An
 * un-approved join request is not a membership: without the filter, asking to
 * join a team immediately reveals that team's meetings. The rule used to be
 * written out twice -- in api/meetings/route.ts and MemberDashboard.tsx -- with
 * a comment in each saying it was load-bearing. Now it is written once.
 */
export async function listApprovedTeamIds(userId: number): Promise<number[]> {
  const memberships = await prisma.teamMember.findMany({
    where: { userId, status: TeamMemberStatus.APPROVED },
    select: { teamId: true },
  });

  return memberships.map((m) => m.teamId);
}

/**
 * Every team with its approved roster. The officer teams table and the two
 * client-side team pickers all read this.
 */
export function listTeams(): Promise<TeamWithMembers[]> {
  return prisma.team.findMany({
    ...teamWithMembersArgs,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

/** The teams a member may still ask to join. */
export function listActiveTeams() {
  return prisma.team.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
}

/** One team with its roster. Throws NOT_FOUND. */
export async function getTeamWithMembers(
  teamId: number,
): Promise<TeamWithMembers> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    ...teamWithMembersArgs,
  });

  if (!team) throw new ServiceError("NOT_FOUND", "Team not found");
  return team;
}

/** The bare row. Throws NOT_FOUND. */
export async function getTeamById(teamId: number) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new ServiceError("NOT_FOUND", "Team not found");
  return team;
}

/**
 * A member's own approved memberships, with team names for the badges.
 *
 * Same APPROVED rule as listApprovedTeamIds; this one carries the name because
 * the dashboard shows teams rather than filtering by them.
 */
export function listApprovedMemberships(userId: number) {
  return prisma.teamMember.findMany({
    where: { userId, status: TeamMemberStatus.APPROVED },
    select: { id: true, team: { select: { name: true } } },
    orderBy: { team: { name: "asc" } },
  });
}

/** Every team request a user has made, in any state. For the pending page. */
export function listOwnTeamRequests(userId: number) {
  return prisma.teamMember.findMany({
    where: { userId },
    select: {
      id: true,
      status: true,
      teamId: true,
      team: { select: { name: true } },
    },
    orderBy: { team: { name: "asc" } },
  });
}
