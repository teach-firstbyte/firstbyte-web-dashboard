import {
  AccountStatus,
  AttendanceStatus,
  TeamMemberStatus,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { getAttendanceCutoff } from "@/lib/attendance/timing";
import { isOfficer } from "@/lib/auth/roles";
import { expectedUsersWhere } from "@/server/attendance/expected";
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
    const [meetings, expectedCount] = await Promise.all([
      prisma.meeting.findMany({
        ...meetingWithRosterArgs,
        orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
      }),
      expectedCounter(),
    ]);
    return meetings.map((m) => ({
      ...m,
      expectedCount: expectedCount(m.teamId),
    }));
  }

  const teamIds = await listApprovedTeamIds(viewer.id);

  const [meetings, expectedCount] = await Promise.all([
    prisma.meeting.findMany({
      include: {
        ...meetingWithRosterArgs.include,
        attendance: {
          ...meetingWithRosterArgs.include.attendance,
          where: { userId: viewer.id },
        },
      },
      where: {
        // Grace window: an in-progress meeting stays visible for three hours
        // past its start, so someone checking in late can still find it.
        scheduledAt: { gt: getAttendanceCutoff() },
        // A null teamId is a club-wide meeting, visible to every member.
        OR: [{ teamId: null }, { teamId: { in: teamIds } }],
      },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    }),
    expectedCounter(),
  ]);
  return meetings.map((m) => ({
    ...m,
    expectedCount: expectedCount(m.teamId),
  }));
}

/**
 * How many people a meeting is for, for every meeting at once: two counts
 * instead of one per meeting. The same rule as expectedUsersWhere, written as
 * a group-by over memberships.
 */
async function expectedCounter(): Promise<(teamId: number | null) => number> {
  const [club, teams] = await Promise.all([
    prisma.user.count({ where: expectedUsersWhere(null) }),
    prisma.teamMember.groupBy({
      by: ["teamId"],
      where: {
        status: TeamMemberStatus.APPROVED,
        user: { status: AccountStatus.APPROVED },
      },
      _count: { _all: true },
    }),
  ]);
  const byTeam = new Map(teams.map((t) => [t.teamId, t._count._all]));
  return (teamId) => (teamId === null ? club : (byTeam.get(teamId) ?? 0));
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

/** Title and start time, for the check-in page. Null when there is no such meeting. */
export async function findMeetingHeading(meetingId: number) {
  return prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { title: true, scheduledAt: true },
  });
}

/**
 * Title, start time and live check-in count, for the projector screens. Null
 * for a meeting that does not exist, like findMeetingTitle. `total` is how
 * many people the meeting is for, plus walk-ins who checked in.
 *
 * Counts in the database rather than loading the roster: the projector page
 * refreshes every few seconds while it is up.
 */
export async function findMeetingCheckInSummary(meetingId: number) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      title: true,
      scheduledAt: true,
      location: true,
      teamId: true,
      attendanceClosedAt: true,
    },
  });
  if (!meeting) return null;

  const expected = expectedUsersWhere(meeting.teamId);
  const [present, expectedCount, walkIns, responses] = await Promise.all([
    prisma.attendance.count({
      where: { meetingId, status: AttendanceStatus.PRESENT },
    }),
    prisma.user.count({ where: expected }),
    prisma.attendance.count({
      where: {
        meetingId,
        status: AttendanceStatus.PRESENT,
        user: { NOT: expected },
      },
    }),
    prisma.feedback.count({ where: { meetingId } }),
  ]);

  return { ...meeting, present, total: expectedCount + walkIns, responses };
}
