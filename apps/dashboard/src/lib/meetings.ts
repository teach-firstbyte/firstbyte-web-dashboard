import { ATTENDANCE_WINDOW_MS } from "@/lib/attendance/timing";

// Meeting rules the UI needs on both the server and in the browser. No
// @prisma/client here (see lib/enums.ts): client components import this file.

/** Mirrors `enum MeetingType` in prisma/schema.prisma, in form order. */
export const MEETING_TYPES = [
  "GENERAL_MEETING",
  "EBOARD_MEETING",
  "FIRSTBITES",
  "WORKSHOP",
] as const;

export type MeetingTypeValue = (typeof MEETING_TYPES)[number];

const TYPE_LABELS: Record<MeetingTypeValue, string> = {
  GENERAL_MEETING: "General meeting",
  EBOARD_MEETING: "E-board meeting",
  FIRSTBITES: "FirstBites",
  WORKSHOP: "Workshop",
};

/** "GENERAL_MEETING" -> "General meeting", instead of showing the raw enum. */
export function meetingTypeLabel(type: string): string {
  return TYPE_LABELS[type as MeetingTypeValue] ?? type.replace(/_/g, " ");
}

export type MeetingPhase = "upcoming" | "live" | "past";

/**
 * Where a meeting is in its life. "Live" is the same three-hour window the
 * server uses for check-in and for showing a meeting to members
 * (getAttendanceCutoff), so the UI never calls a meeting live that check-in
 * has already closed.
 */
export function meetingPhase(
  scheduledAt: Date | string,
  now: number = Date.now(),
): MeetingPhase {
  const start = new Date(scheduledAt).getTime();
  if (now < start) return "upcoming";
  if (now < start + ATTENDANCE_WINDOW_MS) return "live";
  return "past";
}

/** "Curriculum team", or "All members" for a club-wide meeting. */
export function audienceLabel(team: { name: string } | null): string {
  return team ? `${team.name} team` : "All members";
}

type RosterLike = { status: string }[];

export function countPresent(attendance: RosterLike): number {
  return attendance.filter((a) => a.status === "PRESENT").length;
}

export function countExcused(attendance: RosterLike): number {
  return attendance.filter((a) => a.status === "EXCUSED").length;
}

/**
 * Present / (Present + Absent), 0-100, or null when nobody is marked either
 * way. Excused people count neither way, the same rule as a member's rate.
 * Once attendance is closed every expected member has a record, so this is
 * "how many of the people we expected showed up".
 */
export function attendancePercent(attendance: RosterLike): number | null {
  const present = countPresent(attendance);
  const decided =
    present + attendance.filter((a) => a.status === "ABSENT").length;
  if (decided === 0) return null;
  return Math.round((present / decided) * 100);
}

/**
 * The meeting happening now, or else the next one coming up. Expects the
 * list in any order.
 */
export function pickCurrentMeeting<T extends { scheduledAt: Date | string }>(
  meetings: T[],
  now: number = Date.now(),
): { meeting: T; phase: "live" | "upcoming" } | null {
  const byTime = [...meetings].sort(
    (a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
  const live = byTime.find((m) => meetingPhase(m.scheduledAt, now) === "live");
  if (live) return { meeting: live, phase: "live" };
  const next = byTime.find(
    (m) => meetingPhase(m.scheduledAt, now) === "upcoming",
  );
  return next ? { meeting: next, phase: "upcoming" } : null;
}

/** Meetings that haven't started yet, soonest first. */
export function upcomingMeetings<T extends { scheduledAt: Date | string }>(
  meetings: T[],
  now: number = Date.now(),
): T[] {
  return meetings
    .filter((m) => meetingPhase(m.scheduledAt, now) === "upcoming")
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
}
