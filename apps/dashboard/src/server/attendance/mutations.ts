import { AttendanceStatus, type Prisma } from "@prisma/client";
import {
  ATTENDANCE_CLOSING_STARTS,
  checkInWindow,
  getAttendanceCutoff,
  isAttendanceClosed,
} from "@/lib/attendance/timing";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import { expectedUsersWhere } from "./expected";
import { getAttendanceById } from "./queries";
import type {
  CreateAttendanceInput,
  ExcuseInput,
  RosterMarkInput,
  UpdateAttendanceInput,
} from "./schema";

/**
 * Creates one attendance record. Officer-only, gated at the route.
 *
 * The duplicate check is explicit rather than left to the @@unique constraint,
 * so the officer reads "already exists" instead of a raw P2002.
 */
export async function createAttendance(
  officer: Viewer,
  input: CreateAttendanceInput,
) {
  const existing = await prisma.attendance.findUnique({
    where: {
      userId_meetingId: {
        userId: input.userId,
        meetingId: input.meetingId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    throw new ServiceError(
      "CONFLICT",
      "An attendance record already exists for this user and meeting",
    );
  }

  return prisma.attendance.create({
    data: { ...input, markedById: officer.id },
  });
}

/**
 * Applies the fields a PUT provided. Officer-only, gated at the route.
 *
 * Returns the bare row, not the joined shape: sending the roster back on every
 * tap would be a lot of bytes for one field.
 */
export async function updateAttendance(
  officer: Viewer,
  attendanceId: number,
  input: UpdateAttendanceInput,
) {
  await getAttendanceById(attendanceId);

  return prisma.attendance.update({
    where: { id: attendanceId },
    data: { ...input, markedById: officer.id },
  });
}

/** Deletes one attendance record. Throws NOT_FOUND. */
export async function deleteAttendance(attendanceId: number) {
  const attendance = await getAttendanceById(attendanceId);
  await prisma.attendance.delete({ where: { id: attendanceId } });
  return attendance;
}

/** The meeting fields every rule below needs. Throws NOT_FOUND. */
async function findMeetingForAttendance(
  meetingId: number,
  db: Prisma.TransactionClient = prisma,
) {
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      teamId: true,
      scheduledAt: true,
      attendanceClosedAt: true,
    },
  });
  if (!meeting) throw new ServiceError("NOT_FOUND", "Meeting not found");
  return meeting;
}

/**
 * Marks the viewer present at a meeting, from the QR check-in flow.
 *
 * Only from 30 minutes before the start to 3 hours after it, so a photo of the
 * code is no use from home on another day.
 *
 * An upsert because there may or may not be a record already: none is the
 * usual case, an excuse turns into Present when they come after all, and so
 * does an Absent from a meeting closed early.
 *
 * The viewer is the subject, never a request field. Check-in is the one write
 * where letting the body name a user would let anyone mark anyone present.
 */
export async function checkInToMeeting(viewer: Viewer, meetingId: number) {
  const meeting = await findMeetingForAttendance(meetingId);

  const window = checkInWindow(meeting.scheduledAt);
  if (window === "too-early") {
    throw new ServiceError(
      "FORBIDDEN",
      "Check-in opens 30 minutes before the meeting starts.",
    );
  }
  if (window === "closed") {
    throw new ServiceError(
      "FORBIDDEN",
      "Check-in for this meeting has closed. Ask an officer to mark you present.",
    );
  }

  const data = {
    status: AttendanceStatus.PRESENT,
    checkedInAt: new Date(),
    markedById: viewer.id,
  };

  return prisma.attendance.upsert({
    where: { userId_meetingId: { userId: viewer.id, meetingId } },
    update: data,
    create: { ...data, userId: viewer.id, meetingId },
  });
}

/**
 * "I can't make it": the viewer excuses themselves from a meeting.
 *
 * Only before the start. After that, only an officer can excuse someone. No
 * officer approval is needed: officers see the excuse on the officer home and
 * on the roster.
 */
export async function excuseSelf(
  viewer: Viewer,
  meetingId: number,
  input: ExcuseInput,
) {
  const meeting = await findMeetingForAttendance(meetingId);

  if (Date.now() >= meeting.scheduledAt.getTime()) {
    throw new ServiceError(
      "FORBIDDEN",
      "This meeting has started. Ask an officer to excuse you.",
    );
  }

  const expected = await prisma.user.count({
    where: { AND: [{ id: viewer.id }, expectedUsersWhere(meeting.teamId)] },
  });
  if (expected === 0) {
    throw new ServiceError(
      "FORBIDDEN",
      "This meeting isn't one you're expected at.",
    );
  }

  const existing = await prisma.attendance.findUnique({
    where: { userId_meetingId: { userId: viewer.id, meetingId } },
    select: { status: true },
  });
  if (existing?.status === AttendanceStatus.PRESENT) {
    throw new ServiceError("CONFLICT", "You're already checked in.");
  }

  const data = {
    status: AttendanceStatus.EXCUSED,
    notes: input.reason,
    checkedInAt: null,
    markedById: viewer.id,
  };

  return prisma.attendance.upsert({
    where: { userId_meetingId: { userId: viewer.id, meetingId } },
    update: data,
    create: { ...data, userId: viewer.id, meetingId },
  });
}

/**
 * Takes back the viewer's own excuse, before the meeting starts. An excuse an
 * officer gave stays: only an officer can change it.
 */
export async function withdrawExcuse(viewer: Viewer, meetingId: number) {
  const meeting = await findMeetingForAttendance(meetingId);

  if (Date.now() >= meeting.scheduledAt.getTime()) {
    throw new ServiceError(
      "FORBIDDEN",
      "This meeting has started. Ask an officer to change your attendance.",
    );
  }

  const existing = await prisma.attendance.findUnique({
    where: { userId_meetingId: { userId: viewer.id, meetingId } },
    select: { id: true, status: true, markedById: true },
  });
  if (existing?.status !== AttendanceStatus.EXCUSED) {
    throw new ServiceError("NOT_FOUND", "You haven't said you can't make it.");
  }
  if (existing.markedById !== viewer.id) {
    throw new ServiceError(
      "FORBIDDEN",
      "An officer excused you. Ask them to change it.",
    );
  }

  await prisma.attendance.delete({ where: { id: existing.id } });
}

/**
 * An officer marks one person on a meeting's roster: Present, Excused or
 * Absent, or null to clear them back to "not marked". Works before, during
 * and after the meeting, closed or not -- closing only stops new people being
 * added to the roster automatically.
 */
export async function markOnRoster(
  officer: Viewer,
  meetingId: number,
  userId: number,
  input: RosterMarkInput,
) {
  await findMeetingForAttendance(meetingId);
  const where = { userId_meetingId: { userId, meetingId } };

  if (input.status === null) {
    await prisma.attendance.deleteMany({ where: { userId, meetingId } });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new ServiceError("NOT_FOUND", "Member not found");

  const data = { status: input.status, markedById: officer.id };
  return prisma.attendance.upsert({
    where,
    update: data,
    create: { ...data, userId, meetingId },
  });
}

/**
 * Close attendance: everyone the meeting is for who isn't Present, Excused or
 * already Absent is marked Absent, and the meeting records when it closed.
 *
 * `officer` is null when it closes by itself (closeOverdueMeetings). Closing
 * a closed meeting does nothing, so a double click or a retried request is
 * harmless.
 */
export async function closeAttendance(
  officer: Viewer | null,
  meetingId: number,
) {
  return prisma.$transaction(async (tx) => {
    const meeting = await findMeetingForAttendance(meetingId, tx);

    if (Date.now() < meeting.scheduledAt.getTime()) {
      throw new ServiceError("INVALID", "This meeting hasn't started yet.");
    }
    if (isAttendanceClosed(meeting)) return { markedAbsent: 0 };

    const [expected, records] = await Promise.all([
      tx.user.findMany({
        where: expectedUsersWhere(meeting.teamId),
        select: { id: true },
      }),
      tx.attendance.findMany({
        where: { meetingId },
        select: { userId: true, status: true },
      }),
    ]);

    const decided = new Set(
      records
        .filter((r) => r.status !== AttendanceStatus.REGISTERED)
        .map((r) => r.userId),
    );
    const absentIds = expected
      .map((u) => u.id)
      .filter((id) => !decided.has(id));
    const markedById = officer?.id ?? null;

    // Leftover REGISTERED rows (see expected.ts) are replaced, not kept: the
    // people still expected become Absent below, the rest just go.
    await tx.attendance.deleteMany({
      where: { meetingId, status: AttendanceStatus.REGISTERED },
    });
    await tx.attendance.createMany({
      data: absentIds.map((userId) => ({
        userId,
        meetingId,
        status: AttendanceStatus.ABSENT,
        markedById,
      })),
      // A check-in can land between the read above and this write. That
      // person keeps their Present.
      skipDuplicates: true,
    });
    await tx.meeting.update({
      where: { id: meetingId },
      data: { attendanceClosedAt: new Date() },
    });

    return { markedAbsent: absentIds.length };
  });
}

/**
 * Closes attendance for every meeting whose check-in window ended without an
 * officer closing it. Run every hour by the Vercel Cron job.
 */
export async function closeOverdueMeetings() {
  const overdue = await prisma.meeting.findMany({
    where: {
      attendanceClosedAt: null,
      scheduledAt: {
        gte: ATTENDANCE_CLOSING_STARTS,
        lt: getAttendanceCutoff(),
      },
    },
    select: { id: true },
  });

  // One at a time: each is its own transaction, and there are rarely more
  // than one or two.
  let markedAbsent = 0;
  for (const m of overdue) {
    markedAbsent += (await closeAttendance(null, m.id)).markedAbsent;
  }

  return { closed: overdue.length, markedAbsent };
}
