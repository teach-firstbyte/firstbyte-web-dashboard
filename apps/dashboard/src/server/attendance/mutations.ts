import { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import { getAttendanceById } from "./queries";
import type { CreateAttendanceInput, UpdateAttendanceInput } from "./schema";

/**
 * Creates one attendance record. Officer-only, gated at the route.
 *
 * The duplicate check is explicit rather than left to the @@unique constraint,
 * so the officer reads "already exists" instead of a raw P2002.
 */
export async function createAttendance(input: CreateAttendanceInput) {
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

  return prisma.attendance.create({ data: input });
}

/**
 * Applies the fields a PUT provided.
 *
 * Returns the bare row, not the joined shape: AttendanceToggle reads
 * `updated.status` off this response to reconcile its optimistic update, and
 * sending the roster back on every tap would be a lot of bytes for one field.
 */
export async function updateAttendance(
  attendanceId: number,
  input: UpdateAttendanceInput,
) {
  await getAttendanceById(attendanceId);

  return prisma.attendance.update({
    where: { id: attendanceId },
    data: input,
  });
}

/** Deletes one attendance record. Throws NOT_FOUND. */
export async function deleteAttendance(attendanceId: number) {
  const attendance = await getAttendanceById(attendanceId);
  await prisma.attendance.delete({ where: { id: attendanceId } });
  return attendance;
}

/**
 * Marks the viewer present at a meeting, from the QR check-in flow.
 *
 * An upsert because both states are normal: a member on the roster already has
 * a REGISTERED row to update, and someone who joined the club after the meeting
 * was created has none. Either way the check-in must succeed.
 *
 * The viewer is the subject, never a request field. Check-in is the one write
 * where letting the body name a user would let anyone mark anyone present.
 */
export async function checkInToMeeting(viewer: Viewer, meetingId: number) {
  const checkedInAt = new Date();

  return prisma.attendance.upsert({
    where: { userId_meetingId: { userId: viewer.id, meetingId } },
    update: { status: AttendanceStatus.PRESENT, checkedInAt },
    create: {
      userId: viewer.id,
      meetingId,
      status: AttendanceStatus.PRESENT,
      checkedInAt,
    },
  });
}
