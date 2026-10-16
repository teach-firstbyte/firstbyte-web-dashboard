import Link from "next/link";
import { CalendarX2, ClipboardCheck, QrCode, Star } from "lucide-react";

import { Meter } from "@/components/common/Meter";
import { Button } from "@/components/ui/button";
import { formatRelative, formatTime } from "@/lib/format";
import { audienceLabel, countPresent } from "@/lib/meetings";
import type { Meeting } from "@/types/dashboard";
import { MeetingActionsMenu } from "./MeetingActionsMenu";
import { LivePill } from "./MeetingRow";

/**
 * The top card on the officer home: the meeting happening now, or the next
 * one. Its one big button is the thing officers do most at an event, putting
 * the check-in QR code on the projector.
 */
export function CurrentMeetingCard({
  meeting,
  phase,
  locations,
}: {
  meeting: Meeting;
  phase: "live" | "upcoming";
  locations: string[];
}) {
  const present = countPresent(meeting.attendance);
  const invited = meeting.expectedCount;
  // Members who said "I can't make it" (or an officer excused). The in-app
  // notice to officers: there are no emails or push notifications yet.
  const excused = meeting.attendance.filter((a) => a.status === "EXCUSED");
  const meta = [
    phase === "live"
      ? `Started ${formatTime(meeting.scheduledAt)}`
      : formatTime(meeting.scheduledAt),
    meeting.location,
    meeting.isRequired
      ? `Required for ${audienceLabel(meeting.team).toLowerCase()}`
      : audienceLabel(meeting.team),
  ].filter(Boolean);

  return (
    <section className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-primary/30 bg-card p-5">
      {/* The marketing hero's green glow, small. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-16 h-56 w-[60%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_20%,transparent),transparent)]"
      />
      <div className="relative flex items-center justify-between gap-2">
        {phase === "live" ? (
          <LivePill />
        ) : (
          <span className="text-xs font-semibold text-primary">
            Next up · {formatRelative(meeting.scheduledAt)}
          </span>
        )}
        <MeetingActionsMenu meeting={meeting} locations={locations} />
      </div>

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[clamp(1.25rem,2.4vw,1.55rem)] font-bold tracking-tight">
            {meeting.title}
          </h2>
          <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
        </div>
        {phase === "live" && invited > 0 && (
          <div className="flex w-full max-w-56 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl font-bold tabular-nums">{present}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                of {invited} checked in
              </span>
            </div>
            <Meter
              parts={[{ value: present }]}
              total={invited}
              label={`${present} of ${invited} checked in`}
            />
          </div>
        )}
      </div>

      {excused.length > 0 && (
        <div className="relative flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
          <CalendarX2
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p>
            <span className="font-semibold">{excused.length} excused:</span>{" "}
            {excused.map((a) => a.user.name || a.user.email).join(", ")}
          </p>
        </div>
      )}

      <div className="relative flex flex-wrap items-center gap-2">
        <Button asChild size="lg">
          <Link href={`/meetings/${meeting.id}/check-in-display`}>
            <QrCode data-icon="inline-start" />
            Show check-in QR
          </Link>
        </Button>
        {phase === "live" && (
          <Button asChild variant="outline" size="lg">
            <Link href={`/meetings/${meeting.id}/feedback-display`}>
              <Star data-icon="inline-start" />
              Feedback QR
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href={`/meetings/${meeting.id}/attendance`}>
            <ClipboardCheck data-icon="inline-start" />
            Take attendance
          </Link>
        </Button>
      </div>
    </section>
  );
}
