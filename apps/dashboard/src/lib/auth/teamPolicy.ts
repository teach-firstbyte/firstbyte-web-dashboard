// Same no-@prisma/client rule as lib/auth/roles.ts, and for the same reason:
// canAdministerTeamRole is called from client components (the users table, the
// teams table, the approval sheet), which would otherwise drag the ORM shim
// into their bundles. See the note at the top of lib/enums.ts.
import {
  TEAM_JOIN_POLICY,
  type RoleValue,
  type TeamJoinPolicyValue,
} from "@/lib/enums";
import { isSuperAdminRole } from "./roles";

/** A team nobody may ask to join -- it is handed out, not requested. */
export function isInviteOnly(joinPolicy: string): boolean {
  return joinPolicy === TEAM_JOIN_POLICY.INVITE_ONLY;
}

/**
 * May this actor change this team -- its record, or who is on it?
 *
 * Keyed on plain strings so the UI and the server gate read the same line. The
 * denormalized shapes in types/dashboard.ts widen every enum to `string`, so a
 * table row cannot be passed to the typed variant below; without this overload
 * the button an officer sees and the rule the server enforces would be two
 * separate expressions, free to disagree.
 */
export function canAdministerTeamRole(
  role: string,
  joinPolicy: string,
): boolean {
  return !isInviteOnly(joinPolicy) || isSuperAdminRole(role);
}

/** {@link canAdministerTeamRole} for a Viewer and a Prisma-typed team row. */
export function canAdministerTeam(
  actor: { role: RoleValue },
  team: { joinPolicy: TeamJoinPolicyValue },
): boolean {
  return canAdministerTeamRole(actor.role, team.joinPolicy);
}
