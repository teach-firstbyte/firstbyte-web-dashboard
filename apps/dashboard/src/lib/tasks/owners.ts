/**
 * Owner-picker helpers, shared by the meeting page's Action items (#134) and
 * the board's New task form (#135). No imports, so client components and
 * `node --test` both load it as it is.
 */

/**
 * One entry of GET /api/tasks/owners. The same shape as TaskOwnerChoice in
 * server/tasks/queries.ts, written out here so client code never imports
 * from the server folder.
 */
export type OwnerChoice = {
  id: number;
  name: string | null;
  preferredName: string | null;
  /** The ordinary teams they lead, by name. Empty for most officers. */
  leads: { id: number; name: string }[];
};

/** "Priya Nair". Falls back to the preferred name, then a placeholder. */
export function ownerName(o: Pick<OwnerChoice, "name" | "preferredName">) {
  return o.name?.trim() || o.preferredName?.trim() || "Unnamed member";
}

/** "Events lead", "CS Curricula lead, Website lead", or "E-board". */
export function ownerRole(o: Pick<OwnerChoice, "leads">) {
  return o.leads.length
    ? o.leads.map((t) => `${t.name} lead`).join(", ")
    : "E-board";
}

/**
 * The team a new task for this owner is labelled with: the team they lead,
 * or none. Someone leading two teams gets the first by name; the task's
 * creator can change it on the board.
 */
export function ownerTeamId(o: Pick<OwnerChoice, "leads">): number | null {
  return o.leads[0]?.id ?? null;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[\s&,/-]+/)
    .filter(Boolean);

/**
 * The owners whose first name, last name, preferred name or role starts with
 * what was typed, people matched by name first. An empty query matches
 * everyone. "jordan l" matches "Jordan Lee"; "events" matches the Events lead.
 */
export function matchOwners<T extends OwnerChoice>(
  query: string,
  owners: readonly T[],
): T[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return [...owners];

  const byName: T[] = [];
  const byRole: T[] = [];
  for (const o of owners) {
    const name = ownerName(o).toLowerCase();
    const preferred = o.preferredName?.trim().toLowerCase() ?? "";
    const role = ownerRole(o).toLowerCase();
    if (
      name.startsWith(q) ||
      (preferred && preferred.startsWith(q)) ||
      words(name).some((w) => w.startsWith(q))
    ) {
      byName.push(o);
    } else if (
      role.startsWith(q) ||
      words(role).some((w) => w.startsWith(q)) ||
      o.leads.some((t) => t.name.toLowerCase().startsWith(q))
    ) {
      byRole.push(o);
    }
  }
  return [...byName, ...byRole];
}

/**
 * Does a task need a new owner? Yes once its owner is off the e-board: taken
 * off the EBOARD team (no approved membership left), or their account is no
 * longer approved (deleted, which also removes every membership, or denied).
 *
 * Worked out each time a task is read, never stored, so it follows the
 * owner's membership with nothing to keep in sync, and clears as soon as
 * someone reassigns the task. While it's true the board shows "Needs a new
 * owner", reminders stop, and the weekly summary lists the task. Nothing is
 * deleted: tasks.owner_id is ON DELETE RESTRICT.
 *
 * `eboardMemberships` is how many approved EBOARD memberships they have (the
 * server reads at most one).
 */
export function ownerNeedsReplacing(owner: {
  accountStatus: string;
  eboardMemberships: number;
}): boolean {
  return owner.accountStatus !== "APPROVED" || owner.eboardMemberships === 0;
}
