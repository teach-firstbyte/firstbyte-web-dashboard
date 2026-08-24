import { BackLink } from "@/components/BackLink";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { FeedbackQR } from "./FeedbackQR";
import { findMeetingTitle } from "@/server/meetings/queries";
import { parseId } from "@/server/validation";

export default async function FeedbackDisplayPage({
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

  const path = `/feedback/${parsedMeetingId}`;

  return (
    <div className="container mx-auto max-w-md p-6 space-y-6">
      <BackLink />
      <FeedbackQR meetingTitle={meetingTitle} path={path} />
    </div>
  );
}
