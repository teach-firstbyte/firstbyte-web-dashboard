import { BackLink } from "@/components/BackLink";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { hasAttended } from "@/server/attendance/queries";
import { findMeetingTitle } from "@/server/meetings/queries";
import { parseId } from "@/server/validation";
import { notFound } from "next/navigation";
import { FeedbackForm } from "@/components/FeedbackForm";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meetingId = parseId(id);

  if (meetingId === null)
    return <p className="p-6 text-center">Invalid meeting.</p>;

  const user = await requireApprovedUser(`/feedback/${id}`);

  if ((await findMeetingTitle(meetingId)) === null) notFound();

  if (!(await hasAttended(user.id, meetingId))) {
    return (
      <p className="p-6 text-center">
        You need to have attended this meeting to leave feedback.
      </p>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <BackLink />
      <FeedbackForm meetingId={meetingId}></FeedbackForm>
    </div>
  );
}
