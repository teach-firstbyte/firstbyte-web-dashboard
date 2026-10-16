import {
  AccountStatus,
  AttendanceStatus,
  Prisma,
  TeamMemberStatus,
} from "@prisma/client";

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

/**
 * The statuses that mean something happened. REGISTERED rows are left over
 * from the old model, in which every expected member got one when the meeting
 * was created; they mean nothing more than "expected", and are read as if
 * there were no record at all. Migration 2 deletes them.
 */
export const DECIDED_STATUSES = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.EXCUSED,
  AttendanceStatus.ABSENT,
] as const;

/** Prisma filter for "a real record", i.e. not a leftover REGISTERED row. */
export const decidedStatus = {
  in: [...DECIDED_STATUSES],
} satisfies Prisma.EnumAttendanceStatusFilter;
