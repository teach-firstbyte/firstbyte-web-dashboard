import { prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { getMeetingById } from "./queries";
import type { CreateMeetingInput, UpdateMeetingInput } from "./schema";

/**
 * Creates a meeting. Nobody gets an attendance record for it yet: records are
 * made when something happens (a check-in, an excuse, an officer's mark), and
 * who the meeting is for is worked out live. See attendance/expected.ts.
 */
export async function createMeeting(input: CreateMeetingInput) {
  // Checked up front so a bad teamId is a 400 with a sentence, rather than a
  // P2003 foreign-key violation surfacing as "Failed to create meeting".
  if (input.teamId !== null) {
    const team = await prisma.team.findUnique({
      where: { id: input.teamId },
      select: { id: true },
    });
    if (!team) throw new ServiceError("INVALID", "That team does not exist");
  }

  return prisma.meeting.create({ data: input });
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
