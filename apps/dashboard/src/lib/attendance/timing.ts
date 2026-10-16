// When attendance can be taken for a meeting. Shared by the server (check-in,
// closing) and the browser (what the screens show), so no @prisma/client here.

/** QR check-in opens this long before the meeting starts. */
export const CHECK_IN_OPENS_BEFORE_MS = 30 * 60 * 1000;

/**
 * How long after the start a meeting counts as happening. Check-in closes,
 * attendance closes by itself, and the screens stop calling it live, all at
 * this point.
 */
export const ATTENDANCE_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Meetings that start before this were run under the old attendance model, in
 * which every expected member got a record when the meeting was created. They
 * count as closed already: closing one now would mark today's members absent
 * at a meeting from before they joined. Migration 2 sets attendance_closed_at
 * on them, after which this can go.
 */
export const ATTENDANCE_CLOSING_STARTS = new Date("2026-10-17T04:00:00Z");

/** Meetings that started before this are past their attendance window. */
export function getAttendanceCutoff(now: number = Date.now()): Date {
  return new Date(now - ATTENDANCE_WINDOW_MS);
}

export type CheckInWindow = "too-early" | "open" | "closed";

/** Where `now` falls in a meeting's check-in window. */
export function checkInWindow(
  scheduledAt: Date | string,
  now: number = Date.now(),
): CheckInWindow {
  const start = new Date(scheduledAt).getTime();
  if (now < start - CHECK_IN_OPENS_BEFORE_MS) return "too-early";
  if (now > start + ATTENDANCE_WINDOW_MS) return "closed";
  return "open";
}

/**
 * Is attendance for this meeting closed? Closed means the roster is final:
 * officers can still change one person, but nobody new is added to it.
 */
export function isAttendanceClosed(meeting: {
  scheduledAt: Date | string;
  attendanceClosedAt: Date | string | null;
}): boolean {
  return (
    meeting.attendanceClosedAt !== null ||
    new Date(meeting.scheduledAt) < ATTENDANCE_CLOSING_STARTS
  );
}
