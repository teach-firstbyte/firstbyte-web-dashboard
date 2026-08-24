import { AttendanceToggle } from "./AttendanceToggle";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { BackLink } from "@/components/BackLink";
import { findMeetingTitle } from "@/server/meetings/queries";
import { parseId } from "@/server/validation";

export default async function MeetingAttendancePage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  await requireOfficer();
  const { meetingId } = await params;

  const parsedMeetingId = parseId(meetingId);
  if (parsedMeetingId === null) {
    return <p className="p-6 text-center">Invalid meeting.</p>;
  }

  const meetingTitle = await findMeetingTitle(parsedMeetingId);
  if (meetingTitle === null) {
    return <p className="p-6 text-center">Meeting not found.</p>;
  }

  return (
    <div className="container mx-auto max-w-2xl p-6 space-y-6">
      <BackLink />
      <AttendanceToggle
        meetingId={parsedMeetingId}
        meetingTitle={meetingTitle}
      />
    </div>
  );
}
