import { notFound } from "next/navigation";

import { PageHeader } from "@/components/common/Section";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { AppShell } from "@/components/layout/AppShell";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { getViewMode } from "@/lib/auth/viewMode";
import { hasAttended } from "@/server/attendance/queries";
import { findMeetingTitle } from "@/server/meetings/queries";
import { parseId } from "@/server/validation";

/**
 * Where the feedback QR code lands. `?rating=4` pre-picks the stars, for the
 * star links in the feedback email -- they only open this form, never save on
 * their own, because mail scanners follow links.
 */
export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rating?: string }>;
}) {
  const { id } = await params;
  const { rating } = await searchParams;
  const meetingId = parseId(id);

  if (meetingId === null)
    return <p className="p-6 text-center">Invalid meeting.</p>;

  const user = await requireApprovedUser(`/feedback/${id}`);

  const title = await findMeetingTitle(meetingId);
  if (title === null) notFound();

  const attended = await hasAttended(user.id, meetingId);
  const stars = Number(rating);
  const initialRating =
    Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : 0;

  return (
    <AppShell viewer={user} mode={await getViewMode(user)}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <PageHeader title="Rate this meeting" description={title} />
        <div className="rounded-2xl border bg-card p-5">
          {attended ? (
            <FeedbackForm meetingId={meetingId} initialRating={initialRating} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Only people who checked in can rate a meeting. If you were there,
              ask an officer to mark you present.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
