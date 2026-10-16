import { AccountStatus, Prisma, TeamMemberStatus } from "@prisma/client";

/**
 * Who a meeting is for, right now.
 *   team meeting (teamId set)  -> approved members of that team
 *   club meeting (teamId null) -> every approved account
 *
 * Both filters matter. A pending join request is not a membership, and a
 * pending account is not a member -- without the account filter, a club
 * meeting would expect everyone still onboarding, waiting on review, or
 * already denied.
 *
 * Worked out when it is needed rather than stored, so someone approved after
 * the meeting was created is expected too. Closing attendance is what freezes
 * it: from then on the meeting's records are the roster.
 */
export function expectedUsersWhere(
  teamId: number | null,
): Prisma.UserWhereInput {
  if (teamId === null) return { status: AccountStatus.APPROVED };
  return {
    status: AccountStatus.APPROVED,
    teamMemberships: { some: { teamId, status: TeamMemberStatus.APPROVED } },
  };
}
