// Same no-@prisma/client rule as lib/auth/roles.ts, and for the same reason:
// canDeleteAccount and promotableRoles are called from the Members panel to
// decide which buttons to show, and from the services that enforce them. See
// the note at the top of lib/enums.ts.
import { ACCOUNT_STATUS } from "@/lib/enums";
import {
  isOfficerRole,
  isSuperAdminRole,
  OFFICER_ROLES,
  ROLES_LOW_TO_HIGH,
  type OfficerRoleValue,
} from "./roles";

/**
 * May this officer delete this other person's account?
 *
 *   a member              no -- members only delete themselves, from Settings
 *   an officer            yes for members, no for other officers
 *   a super admin         yes for members and for other officers
 *   anyone, on themselves no -- that is the Settings flow, which has its own
 *                         last-officer check and signs them out
 *
 * Keyed on plain role strings so a table row (types/dashboard.ts widens enums
 * to `string`) and a Viewer both fit. That way the button an officer sees and
 * the rule the server enforces are one expression, not two that can disagree.
 */
export function canDeleteAccount(
  actor: { id: number; role: string },
  target: { id: number; role: string },
): boolean {
  if (actor.id === target.id) return false;
  if (!isOfficerRole(actor.role)) return false;
  return !isOfficerRole(target.role) || isSuperAdminRole(actor.role);
}

/** Where a role sits in ROLES_LOW_TO_HIGH, or -1 for a role it does not know. */
function rankOf(role: string): number {
  return (ROLES_LOW_TO_HIGH as readonly string[]).indexOf(role);
}

/**
 * Which roles may this person promote this other person to?
 *
 *   actor is not a super admin      none
 *   target is not APPROVED          none -- not pending, denied, onboarding
 *                                   or deleted accounts
 *   otherwise                       every officer role above the target's
 *                                   current one
 *
 * So a super admin can make a member an officer or a super admin, and an
 * officer a super admin. Nobody can promote a super admin, which also covers a
 * super admin acting on themselves. Lowering a role is not a promotion and is
 * never offered (demotion is a separate feature, which will need the
 * last-officer guard).
 *
 * The Members panel shows one button per role in this list. Same plain-string
 * keys as canDeleteAccount, for the same reason.
 */
export function promotableRoles(
  actor: { id: number; role: string },
  target: { id: number; role: string; status: string },
): OfficerRoleValue[] {
  if (!isSuperAdminRole(actor.role)) return [];
  if (target.status !== ACCOUNT_STATUS.APPROVED) return [];

  const current = rankOf(target.role);
  // A role this list does not know: offer nothing rather than everything.
  if (current === -1) return [];
  return OFFICER_ROLES.filter((role) => rankOf(role) > current);
}

/**
 * {@link promotableRoles} as a yes or no, for promoteUser
 * (server/users/mutations.ts) to check the role a request asks for.
 */
export function canPromote(
  actor: { id: number; role: string },
  target: { id: number; role: string; status: string },
  role: string,
): boolean {
  return (promotableRoles(actor, target) as string[]).includes(role);
}
