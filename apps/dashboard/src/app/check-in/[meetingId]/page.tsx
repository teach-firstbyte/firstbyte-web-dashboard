import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { findMeetingTitle } from "@/server/meetings/queries";
import { parseId } from "@/server/validation";
import { CheckInForm } from "./CheckInForm";
import { BackLink } from "@/components/BackLink";

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ meetingId: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { meetingId } = await params;
  const { code } = await searchParams;

  // Server-only: session + account-status gate. A QR deep link is the most
  // likely way an un-approved account reaches a dashboard route, so this needs
  // the same gate as everything else rather than a bare session check.
  const returnPath = `/check-in/${meetingId}${code ? `?code=${code}` : ""}`;
  await requireApprovedUser(returnPath);

  const parsedMeetingId = parseId(meetingId);
  if (parsedMeetingId === null) {
    return <p className="p-6 text-center">Invalid meeting link.</p>;
  }

  const meetingTitle = await findMeetingTitle(parsedMeetingId);
  if (meetingTitle === null) {
    return <p className="p-6 text-center">Meeting not found.</p>;
  }

  // Hand off to the Client Component for the interactive part
  return (
    <div className="container mx-auto max-w-md p-6 space-y-6">
      <BackLink />
      <CheckInForm
        meetingId={parsedMeetingId}
        meetingTitle={meetingTitle}
        initialCode={code ?? ""}
      />
    </div>
  );
}
