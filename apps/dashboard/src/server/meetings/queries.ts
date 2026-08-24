import { prisma } from "@/lib/prisma";
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
