import { ProjectorScreen } from "@/components/meetings/ProjectorScreen";
import { generateCheckInCode } from "@/lib/attendance/check-in-code";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { findMeetingCheckInSummary } from "@/server/meetings/queries";
import { parseId } from "@/server/validation";

export default async function CheckInDisplayPage({
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

  // Server-only: generate the code with the secret. Only `code` + `path`
  // cross to the client.
  const code = generateCheckInCode(id);

  return (
    <ProjectorScreen
      meetingId={id}
      screen="checkin"
      title={meeting.title}
      scheduledAt={meeting.scheduledAt}
      path={`/check-in/${id}?code=${code}`}
      code={code}
      count={meeting.present}
      total={meeting.total}
    />
  );
}
