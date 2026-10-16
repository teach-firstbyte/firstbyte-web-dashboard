import {
  AccountStatus,
  AttendanceStatus,
  Prisma,
  TeamMemberStatus,
} from "@prisma/client";
import { prisma } from "@/server/db";
import { getAttendanceCutoff } from "@/lib/attendance/timing";
import {
  displayKey,
  hiddenFromHistory,
  keyToWhere,
  parseFilter,
} from "@/lib/attendance/member-status";
import { isAttendanceClosed } from "@/lib/attendance/timing";
import { isOfficer } from "@/lib/auth/roles";
import { getPagination } from "@/lib/pagination";
import { ServiceError } from "@/server/errors";
import { listFeedbackMeetingIds } from "@/server/feedback/queries";
import {
  DECIDED_STATUSES,
  decidedStatus,
  expectedUsersWhere,
} from "./expected";
import type { Page } from "@/server/page";
import { enumParam, pageParam, searchParam } from "@/server/validation";
import type { Viewer } from "@/server/viewer";
import {
  attendanceWithContextArgs,
  type AttendanceWithContext,
  type MeetingRosterPayload,
  type MemberAttendanceRowPayload,
  type RosterRowPayload,
  type RosterStatus,
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
  const status = enumParam(params.status, [...DECIDED_STATUSES]);

  const where: Prisma.AttendanceWhereInput = {
    status: status ?? decidedStatus,
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
 * hiddenFromHistory and keyToWhere take the same cutoff on purpose: a
 * REGISTERED row past the cutoff displays as "Not recorded", one before it is
 * not shown, and the filter for that label has to draw its line in the same
 * place or the filtered list disagrees with the labels in it.
 */
export async function listAttendancePageForMember(
  viewer: Viewer,
  params: SearchParams,
  pageSize: number,
): Promise<Page<MemberAttendanceRowPayload>> {
  const cutoff = getAttendanceCutoff();
  const filter = parseFilter(params.status);

  const AND: Prisma.AttendanceWhereInput[] = [
    { userId: viewer.id },
    { NOT: hiddenFromHistory(cutoff) },
  ];
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
      displayStatus: displayKey(r.status),
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

/**
 * present/absent counts plus the rate they imply, or a null rate when nobody
 * is marked either way. Excused and leftover REGISTERED rows count neither
 * way: an excused absence is not held against anyone.
 */
function summarize(
  rows: { status: AttendanceStatus; _count: { _all: number } }[],
) {
  let present = 0;
  let absent = 0;
  for (const row of rows) {
    if (row.status === AttendanceStatus.PRESENT) present = row._count._all;
    if (row.status === AttendanceStatus.ABSENT) absent = row._count._all;
  }

  const decided = present + absent;
  return { rate: decided > 0 ? present / decided : null, present, absent };
}

/**
 * The two rates, for one member or for the whole club.
 *
 * The main one counts required meetings only, so skipping an optional event
 * never lowers it. `allEventsRate` counts every meeting, and is shown
 * separately with a clear label.
 */
async function attendanceRates(where: Prisma.AttendanceWhereInput) {
  const [required, all] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["status"],
      where: { ...where, meeting: { isRequired: true } },
      _count: { _all: true },
    }),
    prisma.attendance.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
  ]);

  return { ...summarize(required), allEventsRate: summarize(all).rate };
}

/** Club-wide attendance figures, for the officer dashboard. */
export async function getAttendanceStats() {
  return attendanceRates({});
}

/**
 * One member's own attendance figures.
 *
 * `notRecorded` counts rows still REGISTERED for a meeting that already
 * happened -- nobody took attendance. Kept out of the rate on purpose: it is
 * not the member's absence, so counting it against them would be unfair.
 * These rows only exist for meetings from before the attendance rework.
 */
export async function getAttendanceStatsForViewer(viewer: Viewer) {
  const [rates, notRecorded] = await Promise.all([
    attendanceRates({ userId: viewer.id }),
    prisma.attendance.count({
      where: {
        userId: viewer.id,
        status: AttendanceStatus.REGISTERED,
        meeting: { scheduledAt: { lt: getAttendanceCutoff() } },
      },
    }),
  ]);

  return { ...rates, notRecorded };
}

/**
 * Approved members marked ABSENT at `threshold` or more of the last `lookback`
 * required meetings that have finished. For the "missed meetings" list on the
 * officer home.
 *
 * Only explicit ABSENT rows count. A row still REGISTERED means nobody took
 * attendance, and counting that against someone would be unfair -- the same
 * reasoning as `notRecorded` in getAttendanceStatsForViewer.
 */
export async function listMembersMissingMeetings(lookback = 3, threshold = 2) {
  const recent = await prisma.meeting.findMany({
    where: { isRequired: true, scheduledAt: { lt: getAttendanceCutoff() } },
    orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
    take: lookback,
    select: { id: true },
  });
  if (recent.length === 0) return [];

  const groups = await prisma.attendance.groupBy({
    by: ["userId"],
    where: {
      meetingId: { in: recent.map((m) => m.id) },
      status: AttendanceStatus.ABSENT,
    },
    _count: { _all: true },
    having: { userId: { _count: { gte: threshold } } },
  });
  if (groups.length === 0) return [];

  const missedByUser = new Map(groups.map((g) => [g.userId, g._count._all]));
  const users = await prisma.user.findMany({
    where: {
      id: { in: [...missedByUser.keys()] },
      status: AccountStatus.APPROVED,
    },
    select: {
      id: true,
      name: true,
      email: true,
      teamMemberships: {
        where: { status: TeamMemberStatus.APPROVED },
        select: { team: { select: { name: true } } },
        orderBy: { team: { name: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    teams: u.teamMemberships.map((m) => m.team.name),
    missed: missedByUser.get(u.id) ?? 0,
    outOf: recent.length,
  }));
}

/**
 * A member's own finished meetings, most recent last, with whether they've
 * left feedback on each. Drives the "Your attendance" squares and the "Rate
 * past meetings" list on the member home.
 */
export async function listRecentAttendanceForViewer(viewer: Viewer, take = 8) {
  const rows = await prisma.attendance.findMany({
    where: {
      userId: viewer.id,
      meeting: { scheduledAt: { lt: getAttendanceCutoff() } },
    },
    select: {
      id: true,
      meetingId: true,
      status: true,
      meeting: { select: { title: true, scheduledAt: true } },
    },
    orderBy: [{ meeting: { scheduledAt: "desc" } }, { id: "desc" }],
    take,
  });

  const rated = await listFeedbackMeetingIds(
    viewer.id,
    rows
      .filter((r) => r.status === AttendanceStatus.PRESENT)
      .map((r) => r.meetingId),
  );

  return rows.reverse().map((r) => ({
    id: r.id,
    meetingId: r.meetingId,
    status: r.status,
    title: r.meeting.title,
    scheduledAt: r.meeting.scheduledAt,
    hasFeedback: rated.has(r.meetingId),
  }));
}

/**
 * The officer roster for one meeting: one row per person, marked or not.
 *
 * While attendance is open, that is everyone the meeting is for right now,
 * plus anyone else with a record (a walk-in). Once it is closed, the records
 * alone are the roster, so someone approved later doesn't appear on a meeting
 * that was over before they joined.
 *
 * Throws NOT_FOUND.
 */
export async function listMeetingRoster(
  meetingId: number,
): Promise<MeetingRosterPayload> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { teamId: true, scheduledAt: true, attendanceClosedAt: true },
  });
  if (!meeting) throw new ServiceError("NOT_FOUND", "Meeting not found");

  const closed = isAttendanceClosed(meeting);
  const person = { id: true, name: true, email: true } as const;

  const [records, expected] = await Promise.all([
    prisma.attendance.findMany({
      where: { meetingId, status: decidedStatus },
      select: {
        userId: true,
        status: true,
        checkedInAt: true,
        notes: true,
        markedById: true,
        user: { select: person },
      },
    }),
    closed
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: expectedUsersWhere(meeting.teamId),
          select: person,
        }),
  ]);

  const expectedIds = new Set(expected.map((u) => u.id));
  const rows = new Map<number, RosterRowPayload>();

  for (const u of expected) {
    rows.set(u.id, {
      userId: u.id,
      name: u.name,
      email: u.email,
      status: null,
      checkedInAt: null,
      notes: null,
      selfMarked: false,
      expected: true,
    });
  }
  for (const r of records) {
    rows.set(r.userId, {
      userId: r.userId,
      name: r.user.name,
      email: r.user.email,
      // decidedStatus filtered REGISTERED out above.
      status: r.status as RosterStatus,
      checkedInAt: r.checkedInAt,
      notes: r.notes,
      selfMarked: r.markedById === r.userId,
      expected: closed || expectedIds.has(r.userId),
    });
  }

  return {
    closed,
    closedAt: meeting.attendanceClosedAt,
    rows: [...rows.values()].sort((a, b) =>
      (a.name ?? a.email).localeCompare(b.name ?? b.email),
    ),
  };
}
