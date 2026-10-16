import type { AttendanceStatus, Prisma } from "@prisma/client";

export type MemberAttendanceKey = "PRESENT" | "EXCUSED" | "ABSENT";

export const MEMBER_ATTENDANCE_KEYS: MemberAttendanceKey[] = [
  "PRESENT",
  "EXCUSED",
  "ABSENT",
];

export const MEMBER_ATTENDANCE_LABELS: Record<MemberAttendanceKey, string> = {
  PRESENT: "Present",
  EXCUSED: "Excused",
  ABSENT: "Absent",
};

/** Validates a raw searchParams value against the member key union. */
export function parseFilter(
  raw: string | string[] | undefined,
): MemberAttendanceKey | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  return (MEMBER_ATTENDANCE_KEYS as string[]).includes(value)
    ? (value as MemberAttendanceKey)
    : undefined;
}

/** Maps a filter key to a Prisma where fragment. */
export function keyToWhere(
  key: MemberAttendanceKey,
): Prisma.AttendanceWhereInput {
  return { status: key };
}

/**
 * Maps a stored status to the key it displays as. One to one now; kept as a
 * function so the history table, its filter and the database stay decoupled.
 */
export function displayKey(status: AttendanceStatus): MemberAttendanceKey {
  return status;
}
