/**
 * Compile-time proof that what the services return still satisfies what the
 * client components accept.
 *
 * Same trick as lib/enums.prisma-sync.ts, and for the same reason:
 * types/dashboard.ts cannot import @prisma/client -- not even a type -- so the
 * two definitions can drift apart with nothing to notice. The symptom would be
 * `undefined` in a table cell at runtime, in whichever column the select
 * fragment stopped covering.
 *
 * Nothing imports this module and it declares no runtime values, so it costs
 * zero bundle bytes. tsc typechecks it as part of the project, so it runs on
 * every build.
 *
 * If this file stops compiling: a select fragment no longer covers a field its
 * table renders. Widen the fragment. Do not weaken the assertion, and do not
 * loosen the props type -- both hide the bug instead of fixing it.
 *
 * PR 2 adds VisibleFeedback, PR 3 adds the user and team shapes, PR 4 adds the
 * dashboard payloads. Keep this list growing with them.
 */
import type {
  AttendanceWithContext,
  MemberAttendanceRowPayload,
} from "./attendance/select";
import type { MeetingWithRoster } from "./meetings/select";
import type { VisibleFeedback } from "./feedback/select";
import type {
  Attendance,
  Feedback,
  MemberAttendanceRow,
  Meeting,
} from "@/types/dashboard";

/**
 * Resolves to `false` rather than `never` on a mismatch, so the failure reads
 * as `Type 'false' does not satisfy the constraint 'true'` and points here.
 * The tuple wrapper stops a union payload from distributing and passing by
 * accident.
 */
type Satisfies<Payload, Props> = [Payload] extends [Props] ? true : false;
type Assert<T extends true> = T;

export type MeetingPropsInSync = Assert<Satisfies<MeetingWithRoster, Meeting>>;
export type AttendancePropsInSync = Assert<
  Satisfies<AttendanceWithContext, Attendance>
>;
export type MemberAttendancePropsInSync = Assert<
  Satisfies<MemberAttendanceRowPayload, MemberAttendanceRow>
>;
export type FeedbackPropsInSync = Assert<Satisfies<VisibleFeedback, Feedback>>;
