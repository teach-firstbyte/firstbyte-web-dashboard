/**
 * Schema enum values and types, with NO dependency on @prisma/client.
 *
 * Anything that can end up in a client bundle -- a "use client" component, or a
 * module one of them imports -- must get its enum values and types from here
 * rather than from @prisma/client. Server code (route handlers, server actions,
 * server components, server/db callers) should keep importing the real enums
 * from @prisma/client directly.
 *
 * Why the hard line, including on `import type`: a runtime `import { Role } from
 * "@prisma/client"` pulls the ORM's browser shim (~9KB: the enum objects plus a
 * PrismaClient stub that throws when constructed) into every chunk that touches
 * it. A type-only import is erased and costs nothing, but "runtime imports are
 * forbidden, type imports are fine" is a rule nobody can enforce by reading a
 * diff. "No @prisma/client in client code, ever" is one grep, so that is the rule.
 *
 * Keeping this in sync with prisma/schema.prisma is NOT left to reviewer
 * discipline: lib/enums.prisma-sync.ts asserts at the type level that each union
 * below matches the generated Prisma enum exactly, and fails the build if the
 * schema gains, loses, or renames a value. That file is type-only and imported by
 * nothing, so the check costs no bundle bytes.
 */

/** Mirrors `enum Role` in prisma/schema.prisma. */
export const ROLE = {
  NORTHEASTERN_STUDENT: "NORTHEASTERN_STUDENT",
  NORTHEASTERN_ADMIN: "NORTHEASTERN_ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type RoleValue = (typeof ROLE)[keyof typeof ROLE];

/**
 * Mirrors `enum AttendanceStatus`. Declaration order is load-bearing: the
 * attendance filter renders `Object.values(...)` directly, so this is the order
 * the options appear in.
 */
export const ATTENDANCE_STATUS = {
  REGISTERED: "REGISTERED",
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
} as const;

export type AttendanceStatusValue =
  (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

/** Mirrors `enum TeamMemberStatus`. */
export const TEAM_MEMBER_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type TeamMemberStatusValue =
  (typeof TEAM_MEMBER_STATUS)[keyof typeof TEAM_MEMBER_STATUS];

/** Mirrors `enum TeamJoinPolicy`. */
export const TEAM_JOIN_POLICY = {
  OPEN: "OPEN",
  INVITE_ONLY: "INVITE_ONLY",
} as const;

export type TeamJoinPolicyValue =
  (typeof TEAM_JOIN_POLICY)[keyof typeof TEAM_JOIN_POLICY];
