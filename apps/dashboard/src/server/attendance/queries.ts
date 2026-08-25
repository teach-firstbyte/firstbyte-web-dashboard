import { AttendanceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { getAttendanceCutoff } from "@/lib/attendance/cutoff";
import {
  displayKey,
  keyToWhere,
  parseFilter,
} from "@/lib/attendance/member-status";
import { isOfficer } from "@/lib/auth/roles";
import { getPagination } from "@/lib/pagination";
import { ServiceError } from "@/server/errors";
import { listFeedbackMeetingIds } from "@/server/feedback/queries";
import type { Page } from "@/server/page";
import { enumParam, pageParam, searchParam } from "@/server/validation";
import type { Viewer } from "@/server/viewer";
import {
  attendanceWithContextArgs,
  type AttendanceWithContext,
  type MemberAttendanceRowPayload,
} from "./select";
import type { AttendanceFilter } from "./schema";

/** Next.js gives search params in this shape. */
type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * The attendance rows a viewer may read.
 *
 * An officer may filter by anyone. For everybody else `userId` is replaced with
 * their own id, whatever they sent -- the request can narrow what they see, but
 * it can never widen it. That rule used to live in the route handler as a
 * comment and an assignment.
 */
export async function listAttendanceForViewer(
  viewer: Viewer,
  filter: AttendanceFilter,
): Promise<AttendanceWithContext[]> {
  const where: Prisma.AttendanceWhereInput = {
    meetingId: filter.meetingId,
    userId: isOfficer(viewer) ? filter.userId : viewer.id,
  };

  return prisma.attendance.findMany({
    where,
    ...attendanceWithContextArgs,
    orderBy: [{ id: "asc" }],
  });
}

/**
 * One page of the officer attendance table, with its search and status filter
 * applied.
 *
 * Takes the raw search params rather than parsed values: the page number, the
 * search term and the status filter are all inputs to the same query, and
 * splitting the parsing across two files is how they drift apart.
 */
export async function listAttendancePageForOfficer(
  params: SearchParams,
  pageSize: number,
): Promise<Page<AttendanceWithContext>> {
  const q = searchParam(params.q);
  const status = enumParam(params.status, Object.values(AttendanceStatus));

  const where: Prisma.AttendanceWhereInput = {
    status,
    OR: q
      ? [
          { user: { name: { contains: q, mode: "insensitive" } } },
          { user: { email: { contains: q, mode: "insensitive" } } },
          { meeting: { title: { contains: q, mode: "insensitive" } } },
        ]
      : undefined,
  };

  const total = await prisma.attendance.count({ where });
  const pagination = getPagination({
    page: pageParam(params.page),
    pageSize,
    total,
  });

  const rows = await prisma.attendance.findMany({
    where,
    ...attendanceWithContextArgs,
    // nulls last so records nobody has checked in yet sink below real activity.
    orderBy: [{ checkedInAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    skip: pagination.skip,
    take: pagination.take,
  });

  return {
    rows,
    total,
    page: pagination.page,
    totalPages: pagination.totalPages,
    hasPrev: pagination.hasPrev,
    hasNext: pagination.hasNext,
    filtersActive: Boolean(q || status),
  };
}

/**
 * One page of a member's own attendance history.
 *
 * The viewer's own id is an AND term rather than a plain `userId`, so a status
 * filter can never displace it.
 *
 * displayKey and keyToWhere both take the same cutoff on purpose: a row past
 * the cutoff that is still REGISTERED displays as "Not recorded", and the
 * filter for that label has to draw its line in the same place or the filtered
 * list disagrees with the labels in it.
 */
export async function listAttendancePageForMember(
  viewer: Viewer,
  params: SearchParams,
  pageSize: number,
): Promise<Page<MemberAttendanceRowPayload>> {
  const cutoff = getAttendanceCutoff();
  const filter = parseFilter(params.status);

  const AND: Prisma.AttendanceWhereInput[] = [{ userId: viewer.id }];
  if (filter) AND.push(keyToWhere(filter, cutoff));
  const where: Prisma.AttendanceWhereInput = { AND };

  const total = await prisma.attendance.count({ where });
  const pagination = getPagination({
    page: pageParam(params.page),
    pageSize,
    total,
  });

  const records = await prisma.attendance.findMany({
    where,
    select: {
      id: true,
      meetingId: true,
      status: true,
      meeting: { select: { title: true, scheduledAt: true } },
    },
    orderBy: [{ meeting: { scheduledAt: "desc" } }, { id: "desc" }],
    skip: pagination.skip,
    take: pagination.take,
  });

  // Only meetings they actually attended can take feedback, so only those are
  // worth looking up.
  const presentMeetingIds = records
    .filter((r) => r.status === AttendanceStatus.PRESENT)
    .map((r) => r.meetingId);

  const feedbackMeetingIds = await listFeedbackMeetingIds(
    viewer.id,
    presentMeetingIds,
  );

  return {
    rows: records.map((r) => ({
      id: r.id,
      meetingId: r.meetingId,
      displayStatus: displayKey(r.status, r.meeting.scheduledAt, cutoff),
      hasFeedback: feedbackMeetingIds.has(r.meetingId),
      meeting: {
        title: r.meeting.title,
        scheduledAt: r.meeting.scheduledAt,
      },
    })),
    total,
    page: pagination.page,
    totalPages: pagination.totalPages,
    hasPrev: pagination.hasPrev,
    hasNext: pagination.hasNext,
    filtersActive: Boolean(filter),
  };
}

/** One attendance row with its user and meeting. Throws NOT_FOUND. */
export async function getAttendanceById(
  attendanceId: number,
): Promise<AttendanceWithContext> {
  const attendance = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    ...attendanceWithContextArgs,
  });

  if (!attendance) throw new ServiceError("NOT_FOUND", "Attendance not found");
  return attendance;
}

/**
 * Did this person attend this meeting?
 *
 * The gate on leaving feedback. REGISTERED is not enough -- signing up for a
 * meeting is not the same as going to it.
 */
export async function hasAttended(
  userId: number,
  meetingId: number,
): Promise<boolean> {
  const record = await prisma.attendance.findUnique({
    where: { userId_meetingId: { userId, meetingId } },
    select: { status: true },
  });

  return record?.status === AttendanceStatus.PRESENT;
}

/** present/absent counts plus the rate they imply, or null when nothing is decided. */
function summarize(
  rows: { status: AttendanceStatus; _count: { _all: number } }[],
) {
  const counts: Record<AttendanceStatus, number> = {
    REGISTERED: 0,
    PRESENT: 0,
    ABSENT: 0,
  };
  for (const row of rows) counts[row.status] = row._count._all;

  const decided = counts.PRESENT + counts.ABSENT;
  return {
    rate: decided > 0 ? counts.PRESENT / decided : null,
    present: counts.PRESENT,
    absent: counts.ABSENT,
  };
}

/** Club-wide attendance figures, for the officer dashboard. */
export async function getAttendanceStats() {
  const rows = await prisma.attendance.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  return summarize(rows);
}

/**
 * One member's own attendance figures.
 *
 * `notRecorded` counts rows still REGISTERED for a meeting that already
 * happened -- nobody took attendance. Kept out of the rate on purpose: it is
 * not the member's absence, so counting it against them would be unfair.
 */
export async function getAttendanceStatsForViewer(viewer: Viewer) {
  const [rows, notRecorded] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["status"],
      where: { userId: viewer.id },
      _count: { _all: true },
    }),
    prisma.attendance.count({
      where: {
        userId: viewer.id,
        status: AttendanceStatus.REGISTERED,
        meeting: { scheduledAt: { lt: getAttendanceCutoff() } },
      },
    }),
  ]);

  return { ...summarize(rows), notRecorded };
}
