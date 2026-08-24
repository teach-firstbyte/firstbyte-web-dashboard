import { Prisma } from "@prisma/client";

/**
 * The query shapes every meeting read uses, plus the types they produce.
 *
 * Prisma.validator, not `satisfies Prisma.MeetingInclude`: a bare object
 * literal makes TypeScript widen `team: true` to `team: boolean`, and
 * MeetingGetPayload then silently drops the relation from the resulting type.
 * The symptom is a compile error about a field that is plainly there at
 * runtime, which is a confusing hour to lose.
 *
 * Note the narrow selects on relations. The old queries used
 * `include: { user: true }`, which shipped every column of every attendee --
 * role, status, gradYear, major -- to an officer's browser in order to render a
 * name and an email.
 */

const rosterEntry = {
  select: {
    id: true,
    status: true,
    checkedInAt: true,
    checkedOutAt: true,
    notes: true,
    user: { select: { name: true, email: true } },
  },
  orderBy: { id: "asc" },
} satisfies Prisma.Meeting$attendanceArgs;

/** A meeting with the attendance rows the reader is allowed to see. */
export const meetingWithRosterArgs =
  Prisma.validator<Prisma.MeetingDefaultArgs>()({
    include: {
      team: { select: { name: true } },
      attendance: rosterEntry,
    },
  });

export type MeetingWithRoster = Prisma.MeetingGetPayload<
  typeof meetingWithRosterArgs
>;

/** One meeting with its roster and its feedback. For the officer detail read. */
export const meetingDetailArgs = Prisma.validator<Prisma.MeetingDefaultArgs>()({
  include: {
    team: { select: { name: true } },
    attendance: rosterEntry,
    feedback: true,
  },
});

export type MeetingDetail = Prisma.MeetingGetPayload<typeof meetingDetailArgs>;
