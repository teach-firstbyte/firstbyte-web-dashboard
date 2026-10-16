import { CheckInForm } from "@/components/attendance/CheckInForm";
import { PageHeader } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { getViewMode } from "@/lib/auth/viewMode";
import { findMeetingTitle } from "@/server/meetings/queries";
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

  const meetingTitle = await findMeetingTitle(parsedMeetingId);
  if (meetingTitle === null) {
    return <p className="p-6 text-center">Meeting not found.</p>;
  }

  return (
    <AppShell viewer={user} mode={await getViewMode(user)}>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-5">
        <PageHeader title="Check in" description={meetingTitle} />
        <div className="rounded-2xl border bg-card p-5">
          <CheckInForm
            meetingId={parsedMeetingId}
            meetingTitle={meetingTitle}
            initialCode={code ?? ""}
          />
        </div>
      </div>
    </AppShell>
  );
}
