import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/server/errors";
import {
  teamMemberWithContextArgs,
  type TeamMemberWithContext,
} from "./select";

/** Every membership, in any state. The officer view of who asked for what. */
export function listTeamMembers(): Promise<TeamMemberWithContext[]> {
  return prisma.teamMember.findMany({
    ...teamMemberWithContextArgs,
    orderBy: [{ teamId: "asc" }, { id: "asc" }],
  });
}

/** One membership with its user and team. Throws NOT_FOUND. */
export async function getTeamMemberById(
  teamMemberId: number,
): Promise<TeamMemberWithContext> {
  const member = await prisma.teamMember.findUnique({
    where: { id: teamMemberId },
    ...teamMemberWithContextArgs,
  });

  if (!member) throw new ServiceError("NOT_FOUND", "Team member not found");
  return member;
}

/** The existing membership for a user/team pair, if there is one. */
export function findMembership(userId: number, teamId: number) {
  return prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
}
