import Link from "next/link";
import { Star } from "lucide-react";

import { ApprovalList } from "@/components/approvals/ApprovalList";
import { MissedMeetingsList } from "@/components/attendance/MissedMeetingsList";
import {
  EmptyState,
  PageHeader,
  RowList,
  Section,
} from "@/components/common/Section";
import { Sparkline } from "@/components/common/Sparkline";
import { AppShell } from "@/components/layout/AppShell";
import { CurrentMeetingCard } from "@/components/meetings/CurrentMeetingCard";
import {
  MeetingActionsMenu,
  NewMeetingButton,
} from "@/components/meetings/MeetingActionsMenu";
import { MeetingRow } from "@/components/meetings/MeetingRow";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { isSuperAdmin } from "@/lib/auth/roles";
import { formatRelative } from "@/lib/format";
import {
  attendancePercent,
  meetingPhase,
  pickCurrentMeeting,
  upcomingMeetings,
} from "@/lib/meetings";
import { getOfficerDashboard } from "@/server/dashboard/queries";
import type { Viewer } from "@/server/viewer";
import type { Meeting } from "@/types/dashboard";

type Data = Awaited<ReturnType<typeof getOfficerDashboard>>;

const EMPTY: Data = {
  pending: [],
  meetings: [],
  feedback: [],
  memberCount: 0,
  missing: [],
};

/** Rooms used before, newest first, for the meeting form's suggestions. */
function recentLocations(meetings: Meeting[]) {
  return [
    ...new Set(meetings.flatMap((m) => (m.location ? [m.location] : []))),
  ].slice(0, 8);
}

/**
 * The officer home: what needs doing today first, the reference tables on
 * their own pages. Laid out as the meeting happening now, what's coming up,
 * the approval queue, members to check on, then three numbers.
 */
export async function OfficerDashboard({ user }: { user: Viewer }) {
  let data = EMPTY;
  let dbUnavailable = false;
  try {
    // One round of parallel queries, inside the service. If it fails, render
    // with empty data and the banner below.
    data = await getOfficerDashboard(user);
  } catch (error) {
    dbUnavailable = true;
    console.error("Database unavailable, rendering empty dashboard:", error);
  }

  const { pending, meetings, feedback, memberCount, missing } = data;
  const now = Date.now();
  const current = pickCurrentMeeting(meetings, now);
  const comingUp = upcomingMeetings(meetings, now)
    .filter((m) => m.id !== current?.meeting.id)
    .slice(0, 3);
  const locations = recentLocations(meetings);
  // The newest general meeting, for "Copy last general meeting".
  const template = meetings.find((m) => m.type === "GENERAL_MEETING") ?? null;
  const waiting = pending.filter((u) => u.status === "PENDING").length;

  // Numbers row. Finished meetings with a roster, newest first.
  const finished = meetings
    .filter((m) => meetingPhase(m.scheduledAt, now) === "past")
    .filter((m) => m.attendance.length > 0);
  const trend = finished
    .slice(0, 8)
    .map((m) => attendancePercent(m.attendance) ?? 0)
    .reverse();
  const lastPercent = trend.at(-1);
  const average = trend.length
    ? Math.round(trend.reduce((a, b) => a + b, 0) / trend.length)
    : null;
  const lastMeeting = finished[0];
  const lastFeedback = lastMeeting
    ? feedback.filter((f) => f.meetingId === lastMeeting.id)
    : [];
  const rated = lastFeedback.filter((f) => f.rating !== null);
  const lastAverage = rated.length
    ? rated.reduce((sum, f) => sum + (f.rating ?? 0), 0) / rated.length
    : null;
  const lowRatings = lastFeedback.filter(
    (f) => f.rating !== null && f.rating <= 2,
  ).length;

  const firstName = (user.preferredName || user.name || "").split(" ")[0];
  const summary = [
    current?.phase === "live"
      ? `${current.meeting.title} is happening now.`
      : current
        ? `Next up: ${current.meeting.title}, ${formatRelative(current.meeting.scheduledAt, now)}.`
        : "Nothing is scheduled yet.",
    waiting > 0
      ? `${waiting} ${waiting === 1 ? "person is" : "people are"} waiting for approval.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <AppShell viewer={user} mode="officer">
      {dbUnavailable && (
        <Banner variant="warning">
          Could not load database data right now. Showing an empty dashboard
          until the connection is restored.
        </Banner>
      )}

      <PageHeader
        title={firstName ? `Hi, ${firstName}` : "Welcome back"}
        description={summary}
        action={<NewMeetingButton template={template} locations={locations} />}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {current ? (
            <CurrentMeetingCard
              meeting={current.meeting}
              phase={current.phase}
              locations={locations}
            />
          ) : (
            <Section title="Next up">
              <EmptyState
                title="No meetings scheduled"
                action={
                  <NewMeetingButton template={template} locations={locations} />
                }
              >
                Plan the next one so members see it on their home page.
              </EmptyState>
            </Section>
          )}

          <Section
            title="Coming up"
            action={
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link href="/meetings">All meetings →</Link>
              </Button>
            }
          >
            {comingUp.length === 0 ? (
              <EmptyState title="Nothing else scheduled">
                New meetings show up here.
              </EmptyState>
            ) : (
              <RowList>
                {comingUp.map((m) => (
                  <li key={m.id}>
                    <MeetingRow
                      meeting={m}
                      phase="upcoming"
                      right={
                        <MeetingActionsMenu meeting={m} locations={locations} />
                      }
                    />
                  </li>
                ))}
              </RowList>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Section id="approvals" title="Waiting for approval" count={waiting}>
            <ApprovalList
              users={pending}
              canManageRestricted={isSuperAdmin(user)}
            />
          </Section>
          <Section title="Missed 2 of the last 3 meetings">
            <MissedMeetingsList members={missing} />
          </Section>
        </div>
      </div>

      <section
        aria-label="Club numbers"
        className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3"
      >
        <Metric label="Attendance, last meeting">
          <div className="flex items-center gap-3">
            <strong className="text-2xl tabular-nums">
              {lastPercent !== undefined ? `${lastPercent}%` : "–"}
            </strong>
            <Sparkline
              values={trend}
              label={`Attendance over the last ${trend.length} meetings`}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {average !== null
              ? `${trend.length}-meeting average ${average}%`
              : "No finished meetings yet"}
            {" · "}
            <Link href="/attendance" className="text-primary hover:underline">
              Records
            </Link>
          </p>
        </Metric>
        <Metric label="Feedback, last meeting">
          <div className="flex items-baseline gap-2">
            <strong className="flex items-center gap-1 text-2xl tabular-nums">
              {lastAverage !== null ? lastAverage.toFixed(1) : "–"}
              <Star
                className="size-4 fill-warning text-warning"
                aria-hidden="true"
              />
            </strong>
            <span className="text-sm text-muted-foreground">
              {lastFeedback.length}{" "}
              {lastFeedback.length === 1 ? "response" : "responses"}
            </span>
          </div>
          <p className="text-sm">
            <Link
              href="/feedback"
              className={
                lowRatings > 0
                  ? "font-medium text-destructive hover:underline"
                  : "text-primary hover:underline"
              }
            >
              {lowRatings > 0
                ? `${lowRatings} low ${lowRatings === 1 ? "rating" : "ratings"} to read →`
                : "Read all feedback →"}
            </Link>
          </p>
        </Metric>
        <Metric label="Active members">
          <strong className="text-2xl tabular-nums">{memberCount}</strong>
          <p className="text-sm">
            <Link href="/members" className="text-primary hover:underline">
              See everyone →
            </Link>
          </p>
        </Metric>
      </section>
    </AppShell>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-card p-5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
