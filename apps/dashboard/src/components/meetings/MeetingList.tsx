"use client";

import * as React from "react";

import { EmptyState } from "@/components/common/Section";
import { Segmented } from "@/components/common/Segmented";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useDetailRow } from "@/hooks/useDetailRow";
import { formatMonthYear } from "@/lib/format";
import {
  attendancePercent,
  countExcused,
  meetingPhase,
  meetingTypeLabel,
} from "@/lib/meetings";
import type { Meeting } from "@/types/dashboard";
import { MeetingActionsMenu } from "./MeetingActionsMenu";
import { MeetingDetailSheet } from "./MeetingDetailSheet";
import { MeetingRow } from "./MeetingRow";

export type FeedbackStats = Record<number, { average: number; count: number }>;

type Group = { label: string; meetings: Meeting[] };

const DAY = 24 * 60 * 60 * 1000;

/** Upcoming: Today / This week / Later. Past: by month, newest first. */
function groupMeetings(meetings: Meeting[], past: boolean): Group[] {
  if (past) {
    const groups = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const label = formatMonthYear(m.scheduledAt);
      groups.set(label, [...(groups.get(label) ?? []), m]);
    }
    return [...groups].map(([label, list]) => ({ label, meetings: list }));
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const tomorrow = startOfToday.getTime() + DAY;
  const nextWeek = startOfToday.getTime() + 7 * DAY;
  const at = (m: Meeting) => new Date(m.scheduledAt).getTime();

  return [
    { label: "Today", meetings: meetings.filter((m) => at(m) < tomorrow) },
    {
      label: "This week",
      meetings: meetings.filter((m) => at(m) >= tomorrow && at(m) < nextWeek),
    },
    { label: "Later", meetings: meetings.filter((m) => at(m) >= nextWeek) },
  ].filter((g) => g.meetings.length > 0);
}

/**
 * Every meeting, for officers. Upcoming or past, a search box and a team
 * filter, grouped by when. Clicking a row opens the detail panel with the full
 * roster; the ⋯ menu holds the actions.
 */
export function MeetingList({
  meetings,
  feedback,
  locations,
}: {
  meetings: Meeting[];
  feedback: FeedbackStats;
  locations: string[];
}) {
  const [when, setWhen] = React.useState<"upcoming" | "past">("upcoming");
  const [query, setQuery] = React.useState("");
  const [team, setTeam] = React.useState("");
  const detail = useDetailRow<Meeting>();

  // Re-resolve the open panel against fresh data after a refresh, the same way
  // ApprovalQueue does, so it never shows a stale roster.
  const selected = detail.selected
    ? (meetings.find((m) => m.id === detail.selected!.id) ?? null)
    : null;

  const [upcoming, past] = React.useMemo(() => {
    const up: Meeting[] = [];
    const done: Meeting[] = [];
    for (const m of meetings) {
      (meetingPhase(m.scheduledAt) === "past" ? done : up).push(m);
    }
    const time = (m: Meeting) => new Date(m.scheduledAt).getTime();
    up.sort((a, b) => time(a) - time(b));
    done.sort((a, b) => time(b) - time(a));
    return [up, done];
  }, [meetings]);

  const teamNames = React.useMemo(
    () =>
      [
        ...new Set(meetings.flatMap((m) => (m.team ? [m.team.name] : []))),
      ].sort(),
    [meetings],
  );

  const q = query.trim().toLowerCase();
  const shown = (when === "upcoming" ? upcoming : past).filter(
    (m) =>
      (!q ||
        m.title.toLowerCase().includes(q) ||
        meetingTypeLabel(m.type).toLowerCase().includes(q) ||
        m.location?.toLowerCase().includes(q)) &&
      (!team || (team === "__all" ? !m.team : m.team?.name === team)),
  );
  const groups = groupMeetings(shown, when === "past");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Which meetings"
          value={when}
          onValueChange={setWhen}
          options={[
            { value: "upcoming", label: "Upcoming", count: upcoming.length },
            { value: "past", label: "Past", count: past.length },
          ]}
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search meetings"
          aria-label="Search meetings"
          className="h-9 max-w-xs flex-1 rounded-full"
        />
        <NativeSelect
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          aria-label="Filter by team"
          className="rounded-full"
        >
          <NativeSelectOption value="">All teams</NativeSelectOption>
          <NativeSelectOption value="__all">
            All-member events
          </NativeSelectOption>
          {teamNames.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {t}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-5 rounded-2xl border bg-card p-5">
        {groups.length === 0 ? (
          <EmptyState title="No meetings match">
            {q || team
              ? "Try a different search or team."
              : when === "upcoming"
                ? "Nothing is scheduled. Plan the next one with New meeting."
                : "Past meetings show up here."}
          </EmptyState>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="grid gap-1">
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {group.label}
              </h2>
              <ul className="divide-y">
                {group.meetings.map((m) => {
                  const phase = meetingPhase(m.scheduledAt);
                  const percent = attendancePercent(m.attendance);
                  const stats = feedback[m.id];
                  return (
                    <li
                      key={m.id}
                      {...detail.getRowProps(m)}
                      className="cursor-pointer rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <MeetingRow
                        meeting={m}
                        phase={phase}
                        right={
                          <div className="flex items-center gap-3">
                            <span className="hidden text-right text-xs leading-tight text-muted-foreground tabular-nums sm:block">
                              {phase === "past" ? (
                                <>
                                  <b className="text-foreground">
                                    {percent ?? 0}%
                                  </b>{" "}
                                  came
                                  <br />
                                  {stats
                                    ? `★ ${stats.average.toFixed(1)} · ${stats.count}`
                                    : "no feedback"}
                                </>
                              ) : (
                                <>
                                  <b className="text-foreground">
                                    {m.expectedCount}
                                  </b>{" "}
                                  invited
                                  {countExcused(m.attendance) > 0 && (
                                    <>
                                      <br />
                                      {countExcused(m.attendance)} excused
                                    </>
                                  )}
                                  {m.maxCapacity ? (
                                    <>
                                      <br />
                                      up to {m.maxCapacity}
                                    </>
                                  ) : null}
                                </>
                              )}
                            </span>
                            <MeetingActionsMenu
                              meeting={m}
                              locations={locations}
                            />
                          </div>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <MeetingDetailSheet
        meeting={selected}
        onOpenChange={detail.onOpenChange}
        onCloseAutoFocus={detail.onCloseAutoFocus}
      />
    </div>
  );
}
