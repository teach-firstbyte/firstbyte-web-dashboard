import { TeamMemberStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
