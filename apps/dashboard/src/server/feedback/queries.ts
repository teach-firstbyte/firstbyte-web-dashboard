import { prisma } from "@/server/db";
import { isOfficer } from "@/lib/auth/roles";
import { ServiceError } from "@/server/errors";
import type { Viewer } from "@/server/viewer";
import {
  feedbackWithContextArgs,
  type FeedbackWithContext,
  type VisibleFeedback,
} from "./select";

/**
 * Blanks the author of an anonymous row unless the reader wrote it.
 *
 * Not exported. The only way to get a row out of this module is through a
 * function that has already applied this, so no caller can forget it -- which
 * is the whole reason the rule moved here.
 *
 * `author` stays an object with null fields rather than becoming null. The API
 * route used to do the latter and OfficerDashboard the former, for the same
 * rule; the object form is what types/dashboard.Feedback already describes, so
 * that is the one that survives.
 */
function redact(row: FeedbackWithContext, viewerId: number): VisibleFeedback {
  if (!row.isAnonymous || row.authorId === viewerId) return row;
  return { ...row, authorId: null, author: { name: null, email: null } };
}

/**
 * The feedback a viewer may read, already redacted.
 *
 * Two rules that used to live in two files, now one function:
 *   visibility -- an officer reads every row, a member reads only their own
 *   anonymity  -- an anonymous row names its author only to that author
 *
 * Note the second rule now applies to officers too, including on their own
 * dashboard. Previously OfficerDashboard blanked every anonymous row while the
 * API handed an author back their own, so the same person saw two different
 * answers depending on which screen they were looking at.
 */
export async function listFeedbackForViewer(
  viewer: Viewer,
): Promise<VisibleFeedback[]> {
  const rows = await prisma.feedback.findMany({
    ...feedbackWithContextArgs,
    where: isOfficer(viewer) ? {} : { authorId: viewer.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return rows.map((row) => redact(row, viewer.id));
}

/** One feedback row the viewer may read, already redacted. Throws NOT_FOUND. */
export async function getFeedbackForViewer(
  viewer: Viewer,
  feedbackId: number,
): Promise<VisibleFeedback> {
  const row = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    ...feedbackWithContextArgs,
  });

  // A member asking for someone else's row gets the same answer as for a row
  // that does not exist. "Forbidden" would confirm it is there.
  if (!row || (!isOfficer(viewer) && row.authorId !== viewer.id)) {
    throw new ServiceError("NOT_FOUND", "Feedback not found");
  }

  return redact(row, viewer.id);
}

/**
 * Has this author already left feedback for this meeting?
 *
 * The one-per-meeting rule has no database constraint behind it, so this is the
 * only thing enforcing it. Adding @@unique([authorId, meetingId]) is filed as a
 * follow-up on #58; until then, two simultaneous submissions can both pass.
 */
export async function hasFeedbackFor(
  authorId: number,
  meetingId: number,
): Promise<boolean> {
  const existing = await prisma.feedback.findFirst({
    where: { authorId, meetingId },
    select: { id: true },
  });

  return existing !== null;
}

/**
 * Which of these meetings the author has already given feedback on.
 *
 * Used by the member attendance view to decide whether to offer a "leave
 * feedback" link per row.
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
