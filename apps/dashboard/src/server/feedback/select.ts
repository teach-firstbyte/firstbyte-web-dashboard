import { Prisma } from "@prisma/client";

/**
 * A feedback row with just enough of its meeting and author to render a table.
 *
 * The old queries used `include: { meeting: true, author: true }`, which sent
 * the author's whole user row -- role, account status, gradYear, major -- to
 * the browser. On a feature whose entire point is controlling who is named,
 * that is the wrong default.
 */
export const feedbackWithContextArgs =
  Prisma.validator<Prisma.FeedbackDefaultArgs>()({
    select: {
      id: true,
      meetingId: true,
      authorId: true,
      rating: true,
      comment: true,
      category: true,
      isAnonymous: true,
      createdAt: true,
      meeting: { select: { title: true, scheduledAt: true } },
      author: { select: { name: true, email: true } },
    },
  });

export type FeedbackWithContext = Prisma.FeedbackGetPayload<
  typeof feedbackWithContextArgs
>;

/**
 * A feedback row that has been through redaction and is safe to send anywhere.
 *
 * Deliberately a different type from FeedbackWithContext. A function returning
 * FeedbackWithContext has not redacted anything yet, and its signature says so
 * -- which is the point, because the two are otherwise identical in shape and
 * impossible to tell apart at a call site.
 *
 * authorId widens to number | null even though the column is NOT NULL, because
 * redaction blanks it. Same for the author's name and email.
 */
export type VisibleFeedback = Omit<
  FeedbackWithContext,
  "authorId" | "author"
> & {
  authorId: number | null;
  author: { name: string | null; email: string | null };
};
