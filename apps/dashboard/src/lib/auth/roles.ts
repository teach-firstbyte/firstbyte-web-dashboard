// No @prisma/client import, not even a type: isOfficerRole is called from client
// components (the users table, team rosters, the detail sheets), which would drag
// the ORM into their bundles. RoleValue is the same string union, kept honest
// against the schema by lib/enums.prisma-sync.ts.
import { ROLE, type RoleValue } from "@/lib/enums";

export const OFFICER_ROLES: RoleValue[] = [
  ROLE.NORTHEASTERN_ADMIN,
  ROLE.SUPER_ADMIN,
];

export function isOfficer(user: { role: RoleValue }) {
  return OFFICER_ROLES.includes(user.role);
}

/**
 * {@link isOfficer} keyed on a plain string.
 *
 * The denormalized UI shapes in types/dashboard.ts widen every enum to `string`,
 * so a roster row cannot be passed to isOfficer directly. Both read the same
 * OFFICER_ROLES list, which is the point: the officer badge shown in the UI can
 * never disagree with the gate that requireOfficer actually enforces.
 */
export function isOfficerRole(role: string): boolean {
  return (OFFICER_ROLES as string[]).includes(role);
}

/**
 * The narrower tier inside {@link isOfficer}: president, vice president, and
 * website lead.
 *
 * Nothing distinguished SUPER_ADMIN from NORTHEASTERN_ADMIN before this -- both
 * were just "officer" -- so this is the first place the two diverge. It exists
 * for invite-only teams (see lib/auth/teamPolicy.ts), where "any officer" is
 * too wide a door.
 */
export function isSuperAdmin(user: { role: RoleValue }) {
  return user.role === ROLE.SUPER_ADMIN;
}

/** {@link isSuperAdmin} keyed on a plain string, for the same reason as {@link isOfficerRole}. */
export function isSuperAdminRole(role: string): boolean {
  return role === ROLE.SUPER_ADMIN;
}
