import Link from "next/link";
import { QrCode } from "lucide-react";

import { AttendanceRoster } from "@/components/attendance/AttendanceRoster";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { formatLongDateTime } from "@/lib/format";
import { meetingPhase } from "@/lib/meetings";
import { findMeetingCheckInSummary } from "@/server/meetings/queries";
import { parseId } from "@/server/validation";

export default async function MeetingAttendancePage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const user = await requireOfficer();
  const { meetingId } = await params;

  const id = parseId(meetingId);
  if (id === null) {
    return <p className="p-6 text-center">Invalid meeting.</p>;
  }
  const meeting = await findMeetingCheckInSummary(id);
  if (meeting === null) {
    return <p className="p-6 text-center">Meeting not found.</p>;
  }

  const past = meetingPhase(meeting.scheduledAt) === "past";

  return (
    <AppShell viewer={user} mode="officer">
      <PageHeader
        back={<BackLink href="/meetings" label="Meetings" />}
        title={past ? "Attendance" : "Take attendance"}
        description={`${meeting.title} · ${formatLongDateTime(meeting.scheduledAt)}`}
        action={
          !past ? (
            <Button asChild variant="outline">
              <Link href={`/meetings/${id}/check-in-display`}>
                <QrCode data-icon="inline-start" />
                Show check-in QR
              </Link>
            </Button>
          ) : undefined
        }
      />
      <AttendanceRoster meetingId={id} scheduledAt={meeting.scheduledAt} />
    </AppShell>
  );
}
