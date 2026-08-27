/**
 * Compile-time proof that lib/enums.ts still matches prisma/schema.prisma.
 *
 * lib/enums.ts deliberately cannot import @prisma/client (see the note there),
 * which would normally mean its hand-written unions could drift from the schema
 * silently. This file is the check that stops that: it is the one place allowed to
 * see both sides.
 *
 * Nothing imports this module and it declares no runtime values, so it contributes
 * zero bytes to any bundle -- but `tsc` still typechecks it as part of the project,
 * so the assertions below run on every build.
 *
 * If a build fails here, prisma/schema.prisma changed and lib/enums.ts has not
 * caught up. Fix lib/enums.ts; do not weaken the assertion.
 */
import type {
  AttendanceStatus,
  Role,
  TeamJoinPolicy,
  TeamMemberStatus,
} from "@prisma/client";
import type {
  AttendanceStatusValue,
  RoleValue,
  TeamJoinPolicyValue,
  TeamMemberStatusValue,
} from "./enums";

/**
 * Mutual assignability, which for string-literal unions means set equality.
 *
 * Resolves to `false` rather than `never` on mismatch: `never extends true` is
 * vacuously satisfied, so a `never` here would make Assert pass and the whole
 * check useless.
 */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Fails to compile unless T is exactly `true`. */
type Assert<T extends true> = T;

export type RoleInSync = Assert<Exact<RoleValue, Role>>;
export type AttendanceStatusInSync = Assert<
  Exact<AttendanceStatusValue, AttendanceStatus>
>;
export type TeamMemberStatusInSync = Assert<
  Exact<TeamMemberStatusValue, TeamMemberStatus>
>;
export type TeamJoinPolicyInSync = Assert<
  Exact<TeamJoinPolicyValue, TeamJoinPolicy>
>;
