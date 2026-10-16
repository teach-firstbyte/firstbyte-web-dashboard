import type { AttendanceStatus, Prisma } from "@prisma/client";

export type MemberAttendanceKey =
  "PRESENT" | "EXCUSED" | "ABSENT" | "NOT_RECORDED";

export const MEMBER_ATTENDANCE_KEYS: MemberAttendanceKey[] = [
  "PRESENT",
  "EXCUSED",
  "ABSENT",
  "NOT_RECORDED",
];

export const MEMBER_ATTENDANCE_LABELS: Record<MemberAttendanceKey, string> = {
  PRESENT: "Present",
  EXCUSED: "Excused",
  ABSENT: "Absent",
  NOT_RECORDED: "Not recorded",
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

/**
 * Rows a member's history never shows: a leftover REGISTERED row for a
 * meeting that hasn't finished. It only meant "expected", and the member home
 * already lists upcoming meetings. Pass the same cutoff as displayKey.
 */
export function hiddenFromHistory(cutoff: Date): Prisma.AttendanceWhereInput {
  return { status: "REGISTERED", meeting: { scheduledAt: { gte: cutoff } } };
}

/** Maps a filter key to a Prisma where fragment. Pass the same cutoff as displayKey */
export function keyToWhere(
  key: MemberAttendanceKey,
  cutoff: Date,
): Prisma.AttendanceWhereInput {
  switch (key) {
    case "PRESENT":
      return { status: "PRESENT" };
    case "EXCUSED":
      return { status: "EXCUSED" };
    case "ABSENT":
      return { status: "ABSENT" };
    case "NOT_RECORDED":
      return {
        status: "REGISTERED",
        meeting: { scheduledAt: { lt: cutoff } },
      };
  }
}

/**
 * Maps a stored row to the key it displays as. A REGISTERED row is from before
 * the attendance rework: nobody took attendance for that person. Rows for
 * meetings that haven't finished are filtered out by hiddenFromHistory.
 */
export function displayKey(status: AttendanceStatus): MemberAttendanceKey {
  if (status === "REGISTERED") return "NOT_RECORDED";
  return status;
}
