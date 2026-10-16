import { CheckInDialog } from "@/components/attendance/CheckInDialog";
import { ExcuseButton } from "@/components/attendance/ExcuseButton";
import { EmptyState, PageHeader, RowList } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { NewMeetingButton } from "@/components/meetings/MeetingActionsMenu";
import {
  MeetingList,
  type FeedbackStats,
} from "@/components/meetings/MeetingList";
import { MeetingRow } from "@/components/meetings/MeetingRow";
import { Banner } from "@/components/ui/banner";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { getViewMode } from "@/lib/auth/viewMode";
import { checkInWindow } from "@/lib/attendance/timing";
import { meetingPhase } from "@/lib/meetings";
import { listFeedbackForViewer } from "@/server/feedback/queries";
import { listMeetingsForViewer } from "@/server/meetings/queries";
import type { Meeting } from "@/types/dashboard";

/**
 * Meetings. Officers get every meeting with Upcoming / Past, search and the
 * ⋯ actions. Members get the upcoming meetings for them, with Check in on the
 * one happening now. Both read listMeetingsForViewer, which already decides
 * who sees what.
 */
export default async function MeetingsPage() {
  const user = await requireApprovedUser("/meetings");
  const mode = await getViewMode(user);

  let meetings: Meeting[] = [];
  let feedback: FeedbackStats = {};
  let dbUnavailable = false;
  try {
    const [rows, responses] = await Promise.all([
      listMeetingsForViewer(user),
      mode === "officer" ? listFeedbackForViewer(user) : Promise.resolve([]),
    ]);
    meetings = rows;
    // Average rating per meeting, for the Past list.
    const sums = new Map<number, { total: number; count: number }>();
    for (const f of responses) {
      if (f.rating === null) continue;
      const s = sums.get(f.meetingId) ?? { total: 0, count: 0 };
      sums.set(f.meetingId, { total: s.total + f.rating, count: s.count + 1 });
    }
    feedback = Object.fromEntries(
      [...sums].map(([id, s]) => [
        id,
        { average: s.total / s.count, count: s.count },
      ]),
    );
  } catch (error) {
    dbUnavailable = true;
    console.error("Meetings query failed:", error);
  }

  const locations = [
    ...new Set(meetings.flatMap((m) => (m.location ? [m.location] : []))),
  ].slice(0, 8);
  const template = meetings.find((m) => m.type === "GENERAL_MEETING") ?? null;
  // Members only ever get upcoming meetings from the service; an officer
  // previewing the member view gets everything, so trim to match.
  const memberMeetings = meetings
    .filter((m) => meetingPhase(m.scheduledAt) !== "past")
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

  return (
    <AppShell viewer={user} mode={mode}>
      {dbUnavailable && (
        <Banner variant="warning">
          Could not load meetings right now. Showing an empty list until the
          connection is restored.
        </Banner>
      )}
      <PageHeader
        title="Meetings"
        description={
          mode === "officer"
            ? "Every meeting and event. Click one for its roster."
            : "Meetings for everyone and for your teams."
        }
        action={
          mode === "officer" ? (
            <NewMeetingButton template={template} locations={locations} />
          ) : undefined
        }
      />
      {mode === "officer" ? (
        <MeetingList
          meetings={meetings}
          feedback={feedback}
          locations={locations}
        />
      ) : (
        <div className="rounded-2xl border bg-card p-5">
          {memberMeetings.length === 0 ? (
            <EmptyState title="Nothing coming up">
              New meetings for you and your teams show up here.
            </EmptyState>
          ) : (
            <RowList>
              {memberMeetings.map((m) => {
                const phase = meetingPhase(m.scheduledAt);
                // Matched by email: an officer previewing gets the full roster.
                const mine = m.attendance.find(
                  (a) => a.user.email === user.email,
                );
                const checkedIn = mine?.status === "PRESENT";
                const canCheckIn =
                  !checkedIn && checkInWindow(m.scheduledAt) === "open";
                return (
                  <li key={m.id}>
                    <MeetingRow
                      meeting={m}
                      phase={phase}
                      showAudience={false}
                      right={
                        canCheckIn ? (
                          <CheckInDialog
                            meetingId={m.id}
                            meetingTitle={m.title}
                          />
                        ) : phase === "upcoming" ? (
                          <ExcuseButton
                            meetingId={m.id}
                            meetingTitle={m.title}
                            status={mine?.status ?? null}
                            selfMarked={mine?.markedById === mine?.userId}
                          />
                        ) : undefined
                      }
                    />
                  </li>
                );
              })}
            </RowList>
          )}
        </div>
      )}
    </AppShell>
  );
}
