import { CheckInForm } from "@/components/attendance/CheckInForm";
import { PageHeader } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { getViewMode } from "@/lib/auth/viewMode";
import {
  checkInWindow,
  CHECK_IN_OPENS_BEFORE_MS,
} from "@/lib/attendance/timing";
import { formatLongDateTime, formatTime } from "@/lib/format";
import { findMeetingHeading } from "@/server/meetings/queries";
import { parseId } from "@/server/validation";

/** Where the projector's QR code lands, with the code already filled in. */
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
  const user = await requireApprovedUser(returnPath);

  const parsedMeetingId = parseId(meetingId);
  if (parsedMeetingId === null) {
    return <p className="p-6 text-center">Invalid meeting link.</p>;
  }

  const meeting = await findMeetingHeading(parsedMeetingId);
  if (meeting === null) {
    return <p className="p-6 text-center">Meeting not found.</p>;
  }
  const meetingTitle = meeting.title;

  // The server checks this too. Saying it up front saves a scan that fails.
  const window = checkInWindow(meeting.scheduledAt);
  const opensAt = new Date(
    meeting.scheduledAt.getTime() - CHECK_IN_OPENS_BEFORE_MS,
  );

  return (
    <AppShell viewer={user} mode={await getViewMode(user)}>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-5">
        <PageHeader title="Check in" description={meetingTitle} />
        <div className="rounded-2xl border bg-card p-5">
          {window === "open" ? (
            <CheckInForm
              meetingId={parsedMeetingId}
              meetingTitle={meetingTitle}
              initialCode={code ?? ""}
            />
          ) : (
            <div role="status" className="flex flex-col gap-1 text-center">
              <p className="font-semibold">
                {window === "too-early"
                  ? `Check-in opens at ${formatTime(opensAt)}`
                  : "Check-in for this meeting has closed"}
              </p>
              <p className="text-sm text-muted-foreground">
                {window === "too-early"
                  ? `The meeting starts ${formatLongDateTime(meeting.scheduledAt)}. Come back then, or scan the code when you arrive.`
                  : "If you were there, ask an officer to mark you present."}
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
