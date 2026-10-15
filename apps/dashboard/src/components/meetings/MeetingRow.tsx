import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { formatWeekdayTime, monthAndDay } from "@/lib/format";
import type { MeetingPhase } from "@/lib/meetings";
import { cn } from "@/lib/utils";

// Presentational meeting pieces with no hooks and no handlers, so server
// components (home pages) and client components (the Meetings list) render the
// same row. Anything clickable is added by the caller around or beside them.

/** Month over day, like a calendar page. Green for a meeting happening now. */
export function DateBadge({
  date,
  phase,
}: {
  date: Date | string;
  phase: MeetingPhase;
}) {
  const { month, day } = monthAndDay(date);
  return (
    <span
      className={cn(
        "grid h-12 w-12 shrink-0 place-content-center rounded-xl text-center",
        phase === "live" && "bg-primary/12 text-primary",
        phase === "upcoming" && "bg-muted",
        phase === "past" && "border bg-transparent text-muted-foreground",
      )}
    >
      <span className="text-[10px] leading-none font-bold tracking-wider uppercase">
        {month}
      </span>
      <span className="text-lg leading-tight font-bold tabular-nums">
        {day}
      </span>
    </span>
  );
}

/** "● Happening now". The dot pulses unless reduced motion is on. */
export function LivePill({ label = "Happening now" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
      <span className="size-2 rounded-full bg-current motion-safe:animate-pulse" />
      {label}
    </span>
  );
}

export type MeetingRowData = {
  title: string;
  scheduledAt: Date | string;
  location: string | null;
  isRequired: boolean;
  team: { name: string } | null;
};

/**
 * One meeting in a list: date badge, title, "Tue 7:00 PM · team · room", and
 * a slot on the right for whatever the list needs there (a count, a button,
 * a ⋯ menu).
 */
export function MeetingRow({
  meeting,
  phase,
  right,
  showAudience = true,
}: {
  meeting: MeetingRowData;
  phase: MeetingPhase;
  right?: React.ReactNode;
  /** Off on member pages, where every meeting shown is already theirs. */
  showAudience?: boolean;
}) {
  const meta = [
    formatWeekdayTime(meeting.scheduledAt),
    showAudience ? (meeting.team?.name ?? "All members") : null,
    meeting.location,
  ].filter(Boolean);

  return (
    <div className="flex min-w-0 items-center gap-3 py-3">
      <DateBadge date={meeting.scheduledAt} phase={phase} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{meeting.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {meta.join(" · ")}
        </p>
      </div>
      {phase === "live" ? (
        <LivePill label="Live" />
      ) : (
        meeting.isRequired &&
        phase === "upcoming" && (
          <Badge variant="warning" className="hidden sm:inline-flex">
            Required
          </Badge>
        )
      )}
      {right}
    </div>
  );
}
