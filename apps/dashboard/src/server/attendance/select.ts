import { Prisma } from "@prisma/client";
import type { MemberAttendanceKey } from "@/lib/attendance/member-status";

/**
 * An attendance row with just enough of its user and meeting to render a table.
 *
 * The old query used `include: { user: true, meeting: true }`, which sent every
 * column of the attendee -- role, account status, gradYear, major -- to the
 * browser so that AttendanceTable could print a name and an email. This select
 * is the exact set of fields types/dashboard.Attendance declares, and nothing
 * more.
 */
export const attendanceWithContextArgs =
  Prisma.validator<Prisma.AttendanceDefaultArgs>()({
    select: {
      id: true,
      userId: true,
      meetingId: true,
      status: true,
      checkedInAt: true,
      notes: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      meeting: { select: { title: true, scheduledAt: true } },
    },
  });

export type AttendanceWithContext = Prisma.AttendanceGetPayload<
  typeof attendanceWithContextArgs
>;

/**
 * One row of a member's own attendance history.
 *
 * Hand-written rather than a GetPayload, because two of its fields do not exist
 * in the database: `displayStatus` is the label the status shows as (a
 * leftover REGISTERED row displays as "Not recorded"), and `hasFeedback` is
 * the answer to a second query.
 *
 * types/dashboard.ts declares the same shape for the client, and
 * props.prisma-sync.ts asserts the two agree. This one is the source of truth,
 * since the service is what builds it.
 */
export interface MemberAttendanceRowPayload {
  id: number;
  meetingId: number;
  displayStatus: MemberAttendanceKey;
  hasFeedback: boolean;
  meeting: {
    title: string;
    scheduledAt: Date;
  };
}

export type RosterStatus = "PRESENT" | "EXCUSED" | "ABSENT";

/**
 * One person on a meeting's officer roster, marked or not. Hand-written: a
 * "not marked" person has no attendance row, so there is no Prisma shape for
 * it. types/dashboard.ts declares the same shape for the client.
 */
export interface RosterRowPayload {
  userId: number;
  name: string | null;
  email: string;
  status: RosterStatus | null;
  checkedInAt: Date | null;
  notes: string | null;
  selfMarked: boolean;
  expected: boolean;
}

export interface MeetingRosterPayload {
  closed: boolean;
  closedAt: Date | null;
  rows: RosterRowPayload[];
}
