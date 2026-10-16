// Same no-@prisma/client rule as lib/auth/roles.ts, and for the same reason:
// canDeleteAccount is called from the Members table to decide whether to show
// the Delete button, and from the service that enforces it. See the note at the
// top of lib/enums.ts.
import { isOfficerRole, isSuperAdminRole } from "./roles";

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
