import { prisma } from "@/lib/prisma";

/**
 * Which of these meetings the author has already given feedback on.
 *
 * Used by the member attendance view to decide whether to offer a "leave
 * feedback" link per row. Lives here rather than in attendance/ because it
 * reads the feedback table, and the one-feedback-per-meeting rule that PR 2
 * moves into this folder will need the same lookup.
 */
export async function listFeedbackMeetingIds(
  authorId: number,
  meetingIds: number[],
): Promise<Set<number>> {
  if (meetingIds.length === 0) return new Set();

  const existing = await prisma.feedback.findMany({
    where: { authorId, meetingId: { in: meetingIds } },
    select: { meetingId: true },
  });

  return new Set(existing.map((f) => f.meetingId));
}
