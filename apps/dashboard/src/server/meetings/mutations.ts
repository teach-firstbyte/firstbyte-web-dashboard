import { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { expectedRoster, getMeetingById } from "./queries";
import type { CreateMeetingInput, UpdateMeetingInput } from "./schema";

/**
 * Creates a meeting and pre-registers the roster it implies.
 *
 * In a transaction, which the two-call version in the route was not: when the
 * createMany failed, the meeting stayed in the database with an empty roster
 * while the officer saw a 500 that suggested nothing had been created.
 */
export async function createMeetingWithRoster(input: CreateMeetingInput) {
  // Checked up front so a bad teamId is a 400 with a sentence, rather than a
  // P2003 foreign-key violation surfacing as "Failed to create meeting".
  if (input.teamId !== null) {
    const team = await prisma.team.findUnique({
      where: { id: input.teamId },
      select: { id: true },
    });
    if (!team) throw new ServiceError("INVALID", "That team does not exist");
  }

  return prisma.$transaction(async (tx) => {
    const meeting = await tx.meeting.create({ data: input });

    const userIds = await expectedRoster(tx, meeting.teamId);
    if (userIds.length > 0) {
      await tx.attendance.createMany({
        data: userIds.map((userId) => ({
          userId,
          meetingId: meeting.id,
          status: AttendanceStatus.REGISTERED,
        })),
        // Attendance has @@unique([userId, meetingId]); a retry must not
        // fail on rows a previous attempt already wrote.
        skipDuplicates: true,
      });
    }

    return meeting;
  });
}

/**
 * Applies the fields a PUT provided and leaves the rest alone.
 *
 * zod's .partial() already dropped absent keys, so the parsed object can be
 * handed to Prisma directly -- that is what replaced the twelve hand-written
 * `...(x !== undefined ? { x } : {})` spreads.
 */
export async function updateMeeting(
  meetingId: number,
  input: UpdateMeetingInput,
) {
  await getMeetingById(meetingId);

  return prisma.meeting.update({ where: { id: meetingId }, data: input });
}

/** Deletes a meeting. Attendance and feedback cascade. Throws NOT_FOUND. */
export async function deleteMeeting(meetingId: number) {
  const meeting = await getMeetingById(meetingId);
  await prisma.meeting.delete({ where: { id: meetingId } });
  return meeting;
}
