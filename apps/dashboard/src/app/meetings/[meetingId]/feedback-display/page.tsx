import { ProjectorScreen } from "@/components/meetings/ProjectorScreen";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { findMeetingCheckInSummary } from "@/server/meetings/queries";
import { parseId } from "@/server/validation";

export default async function FeedbackDisplayPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  await requireOfficer();
  const { meetingId } = await params;

  const id = parseId(meetingId);
  if (id === null) {
    return <p className="p-6 text-center">Invalid meeting.</p>;
  }
  const meeting = await findMeetingCheckInSummary(id);
  if (meeting === null) {
    return <p className="p-6 text-center">Meeting not found.</p>;
  }

  return (
    <ProjectorScreen
      meetingId={id}
      screen="feedback"
      title={meeting.title}
      scheduledAt={meeting.scheduledAt}
      path={`/feedback/${id}`}
      count={meeting.responses}
    />
  );
}
