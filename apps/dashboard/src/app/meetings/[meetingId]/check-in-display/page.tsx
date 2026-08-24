import { generateCheckInCode } from "@/lib/attendance/check-in-code";
import { CheckInQR } from "./CheckInQR";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { BackLink } from "@/components/BackLink";
import { findMeetingTitle } from "@/server/meetings/queries";
import { parseId } from "@/server/validation";

export default async function CheckInDisplayPage({
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

  //Server-only: generate the code with the secret. Only 'code' + 'path' cross to the client.
  const code = generateCheckInCode(parsedMeetingId);
  const path = `/check-in/${parsedMeetingId}?code=${code}`;

  return (
    <div className="container mx-auto max-w-md p-6 space-y-6">
      <BackLink />
      <CheckInQR meetingTitle={meetingTitle} code={code} path={path} />
    </div>
  );
}
