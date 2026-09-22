import { AccountStatus, TeamMemberStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { getAttendanceCutoff } from "@/lib/attendance/cutoff";
import { isOfficer } from "@/lib/auth/roles";
import { ServiceError } from "@/server/errors";
import { listApprovedTeamIds } from "@/server/teams/queries";
import type { Viewer } from "@/server/viewer";
import {
  meetingDetailArgs,
  meetingWithRosterArgs,
  type MeetingDetail,
  type MeetingWithRoster,
} from "./select";

/**
 * Accepts either the ambient client or a `$transaction` callback's client:
 * createMeetingWithRoster reads the roster inside the same transaction that
 * creates the meeting, everyone else reads it standalone. Only the two model
 * delegates this actually calls are named, so either client satisfies it.
 */
type RosterClient = Pick<typeof prisma, "user" | "teamMember">;

/**
 * Who a meeting applies to.
 *   team meeting (teamId set)  -> approved memberships of approved accounts
 *   club meeting (teamId null) -> every approved account
 *
 * Both filters matter. A pending join request is not a membership, and a
 * pending account is not a member -- without the account filter, a club
 * meeting would apply to everyone still onboarding, waiting on review, or
 * already denied.
 *
 * This is also the eligibility rule for the manual attendance roster: a
 * member who is approved (or joins the relevant team) after the meeting was
 * created is still expected to show up here, not just whoever the roster was
 * pre-seeded with at creation time.
 */
export async function expectedRoster(
  client: RosterClient,
  teamId: number | null,
): Promise<number[]> {
  if (teamId === null) {
    const users = await client.user.findMany({
      where: { status: AccountStatus.APPROVED },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  const members = await client.teamMember.findMany({
    where: {
      teamId,
      status: TeamMemberStatus.APPROVED,
      user: { status: AccountStatus.APPROVED },
    },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

/**
 * The meetings a viewer may see, with the roster they may see.
 *
 * One payload shape for both audiences. Officer and member differ only in the
 * where clauses: a member gets their own attendance row where an officer gets
 * everyone's. So no caller has to branch on who is asking, and there is no
 * shape in which a member could accidentally receive someone else's roster.
 *
 * This is the single home of the APPROVED-membership scoping rule, which used
 * to be written out in api/meetings/route.ts and again in MemberDashboard.tsx.
 */
export async function listMeetingsForViewer(
  viewer: Viewer,
): Promise<MeetingWithRoster[]> {
  if (isOfficer(viewer)) {
    return prisma.meeting.findMany({
      ...meetingWithRosterArgs,
      orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
    });
  }

  const teamIds = await listApprovedTeamIds(viewer.id);

  return prisma.meeting.findMany({
    include: {
      ...meetingWithRosterArgs.include,
      attendance: {
        ...meetingWithRosterArgs.include.attendance,
        where: { userId: viewer.id },
      },
    },
    where: {
      // Grace window: an in-progress meeting stays visible for about two hours
      // past its start, so someone checking in late can still find it.
      scheduledAt: { gt: getAttendanceCutoff() },
      // A null teamId is a club-wide meeting, visible to every member.
      OR: [{ teamId: null }, { teamId: { in: teamIds } }],
    },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
  });
}

/** One meeting with its roster and feedback. Throws NOT_FOUND. */
export async function getMeetingDetail(
  meetingId: number,
): Promise<MeetingDetail> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    ...meetingDetailArgs,
  });

  if (!meeting) throw new ServiceError("NOT_FOUND", "Meeting not found");
  return meeting;
}

/** The bare meeting row. Throws NOT_FOUND. For routes that update or delete. */
export async function getMeetingById(meetingId: number) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new ServiceError("NOT_FOUND", "Meeting not found");
  return meeting;
}

/**
 * Just enough to render a page heading.
 *
 * Returns null instead of throwing because the four pages that call it render
 * their own "Meeting not found." message rather than a 404 -- they are reached
 * from a QR code or a hand-typed link, where a friendly line beats an error
 * page.
 */
export async function findMeetingTitle(
  meetingId: number,
): Promise<string | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { title: true },
  });

  return meeting?.title ?? null;
}
