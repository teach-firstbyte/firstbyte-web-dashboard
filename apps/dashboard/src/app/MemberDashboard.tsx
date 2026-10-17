import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { AttendanceSquares } from "@/components/attendance/AttendanceSquares";
import { CheckInDialog } from "@/components/attendance/CheckInDialog";
import { ExcuseButton } from "@/components/attendance/ExcuseButton";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import {
  EmptyState,
  PageHeader,
  RowList,
  Section,
} from "@/components/common/Section";
import { RateMeetingButton } from "@/components/feedback/RateMeetingButton";
import { AppShell } from "@/components/layout/AppShell";
import { LivePill, MeetingRow } from "@/components/meetings/MeetingRow";
import { NewsletterHomeCard } from "@/components/newsletter/SmallActions";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { getViewMode } from "@/lib/auth/viewMode";
import {
  formatLongDateTime,
  formatRelative,
  formatShortDate,
  formatTime,
} from "@/lib/format";
import { checkInWindow } from "@/lib/attendance/timing";
import { pickCurrentMeeting, upcomingMeetings } from "@/lib/meetings";
import { isNewsletterEnabled } from "@/lib/newsletter/enabled";
import { getMemberDashboard } from "@/server/dashboard/queries";
import { getHomeCardIssue } from "@/server/newsletter/queries";
import type { Viewer } from "@/server/viewer";

type Data = Awaited<ReturnType<typeof getMemberDashboard>>;

const EMPTY: Data = {
  memberships: [],
  meetings: [],
  attendance: {
    rate: null,
    allEventsRate: null,
    present: 0,
    absent: 0,
  },
  recent: [],
};

/** "71%", or a dash when nothing has been marked yet. */
function percent(rate: number | null) {
  return rate === null ? "–" : `${Math.round(rate * 100)}%`;
}

/** "Updates from Website, Events and 2 more teams." */
function newsletterSummary(teams: string[]) {
  if (teams.length === 0) return "What's coming up at FirstByte.";
  const shown = teams.slice(0, 2).join(teams.length === 2 ? " and " : ", ");
  const more = teams.length - 2;
  return more > 0
    ? `Updates from ${shown} and ${more} more team${more === 1 ? "" : "s"}.`
    : `Updates from ${shown}.`;
}

/** Feedback is asked for meetings in the last two weeks only. */
const RATE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The member home: check in to what's happening now, see what's next, rate
 * the meetings you went to, and see how your attendance looks.
 *
 * Officers previewing the member view see their own real member data here,
 * because getMemberDashboard is scoped to the viewer.
 */
export async function MemberDashboard({ user }: { user: Viewer }) {
  let data = EMPTY;
  let newsletter: Awaited<ReturnType<typeof getHomeCardIssue>> = null;
  let dbUnavailable = false;
  try {
    [data, newsletter] = await Promise.all([
      getMemberDashboard(user),
      isNewsletterEnabled()
        ? getHomeCardIssue(user, new Date())
        : Promise.resolve(null),
    ]);
  } catch (error) {
    dbUnavailable = true;
    console.error("Member dashboard query failed:", error);
  }
  const mode = await getViewMode(user);

  const { memberships, meetings, recent, attendance } = data;
  const now = Date.now();
  const current = pickCurrentMeeting(meetings, now);
  // A member gets only their own roster row from listMeetingsForViewer, but an
  // officer previewing this view gets the whole roster -- so match by email
  // rather than trusting attendance[0].
  const myRecord = (m: (typeof meetings)[number]) =>
    m.attendance.find((a) => a.user.email === user.email);
  const mine = current ? myRecord(current.meeting) : undefined;
  const checkedIn = mine?.status === "PRESENT";
  const canCheckIn =
    current !== null &&
    !checkedIn &&
    checkInWindow(current.meeting.scheduledAt, now) === "open";
  const comingUp = upcomingMeetings(meetings, now)
    .filter((m) => m.id !== current?.meeting.id)
    .slice(0, 3);
  const toRate = recent
    .filter(
      (r) =>
        r.status === "PRESENT" &&
        !r.hasFeedback &&
        now - new Date(r.scheduledAt).getTime() < RATE_WINDOW_MS,
    )
    .reverse();

  const firstName = (user.preferredName || user.name || "").split(" ")[0];
  const summary =
    current?.phase === "live"
      ? checkedIn
        ? "You're checked in to today's meeting."
        : `${current.meeting.title} is happening now.`
      : current
        ? `Next up: ${current.meeting.title}, ${formatRelative(current.meeting.scheduledAt, now)}.`
        : "No meetings on the calendar yet.";

  return (
    <AppShell viewer={user} mode={mode}>
      {dbUnavailable && (
        <Banner variant="warning">
          Could not load your dashboard right now. Showing an empty view until
          the connection is restored.
        </Banner>
      )}

      <PageHeader
        title={firstName ? `Hi, ${firstName}` : "Welcome"}
        description={summary}
      />

      {newsletter && (
        <NewsletterHomeCard
          issueId={newsletter.id}
          summary={newsletterSummary(
            newsletter.updates.map((u) => u.team.name),
          )}
        />
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {current && (
            <section className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-card p-5">
              {current.phase === "live" ? (
                <LivePill />
              ) : (
                <span className="text-xs font-semibold text-primary">
                  Next up · {formatRelative(current.meeting.scheduledAt, now)}
                </span>
              )}
              <div className="flex flex-col gap-1">
                <h2 className="text-[clamp(1.25rem,2.4vw,1.55rem)] font-bold tracking-tight">
                  {current.meeting.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {[
                    current.phase === "live"
                      ? `Started ${formatTime(current.meeting.scheduledAt)}`
                      : formatLongDateTime(current.meeting.scheduledAt),
                    current.meeting.location,
                    current.meeting.isRequired ? "Required" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {current.meeting.description &&
                  current.phase === "upcoming" && (
                    <p className="pt-1 text-sm">
                      {current.meeting.description}
                    </p>
                  )}
              </div>
              {current.phase === "upcoming" && !canCheckIn && (
                <ExcuseButton
                  meetingId={current.meeting.id}
                  meetingTitle={current.meeting.title}
                  status={mine?.status ?? null}
                  selfMarked={mine?.markedById === mine?.userId}
                />
              )}
              {checkedIn ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="flex items-center gap-2 font-semibold text-primary">
                    <CircleCheck className="size-5" aria-hidden="true" />
                    You&apos;re checked in
                    {mine?.checkedInAt && ` · ${formatTime(mine.checkedInAt)}`}
                  </p>
                  <RateMeetingButton
                    meetingId={current.meeting.id}
                    meetingTitle={current.meeting.title}
                    label="Rate today's meeting"
                  />
                </div>
              ) : canCheckIn ? (
                <div className="flex flex-wrap items-center gap-3">
                  <CheckInDialog
                    meetingId={current.meeting.id}
                    meetingTitle={current.meeting.title}
                  />
                  <span className="text-sm text-muted-foreground">
                    Scan the QR code on the screen, or type the code.
                  </span>
                  {current.phase === "upcoming" && (
                    <ExcuseButton
                      meetingId={current.meeting.id}
                      meetingTitle={current.meeting.title}
                      status={mine?.status ?? null}
                      selfMarked={mine?.markedById === mine?.userId}
                    />
                  )}
                </div>
              ) : null}
            </section>
          )}

          <Section
            title="Coming up for you"
            action={
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link href="/meetings">All meetings →</Link>
              </Button>
            }
          >
            {comingUp.length === 0 ? (
              <EmptyState title="Nothing else scheduled">
                New meetings for you and your teams show up here.
              </EmptyState>
            ) : (
              <RowList>
                {comingUp.map((m) => {
                  const record = myRecord(m);
                  return (
                    <li key={m.id}>
                      <MeetingRow
                        meeting={m}
                        phase="upcoming"
                        showAudience={false}
                        right={
                          <ExcuseButton
                            meetingId={m.id}
                            meetingTitle={m.title}
                            status={record?.status ?? null}
                            selfMarked={record?.markedById === record?.userId}
                          />
                        }
                      />
                    </li>
                  );
                })}
              </RowList>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {toRate.length > 0 && (
            <Section title="Rate past meetings">
              <RowList>
                {toRate.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatShortDate(r.scheduledAt)} · you went
                      </p>
                    </div>
                    <RateMeetingButton
                      meetingId={r.meetingId}
                      meetingTitle={r.title}
                    />
                  </li>
                ))}
              </RowList>
            </Section>
          )}

          <Section
            title="Your attendance"
            action={
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link href="/attendance">History →</Link>
              </Button>
            }
          >
            {recent.length === 0 ? (
              <EmptyState title="Nothing yet">
                After your first meeting, it shows up here.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-3xl font-bold tabular-nums">
                    {percent(attendance.rate)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    of required meetings · All events:{" "}
                    {percent(attendance.allEventsRate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Excused absences don&apos;t count either way.
                  </p>
                </div>
                <AttendanceSquares items={recent} />
              </div>
            )}
          </Section>

          <Section
            title="Your teams"
            action={
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link href="/settings#teams">Manage →</Link>
              </Button>
            }
          >
            {memberships.length === 0 ? (
              <EmptyState title="Not on a team yet">
                Pick one in Settings and an officer will review it.
              </EmptyState>
            ) : (
              <RowList>
                {memberships.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <PersonAvatar name={m.team.name} />
                    <span className="font-semibold">{m.team.name}</span>
                  </li>
                ))}
              </RowList>
            )}
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
