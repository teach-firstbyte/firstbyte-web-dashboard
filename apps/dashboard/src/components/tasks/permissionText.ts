// What the board says about who can change a task the viewer can't, so the
// kanban's lock hint and the task panel's note tell the same story. Pure, so
// `node --test` covers it (permissionText.test.ts).
//
// The rule (lib/auth/taskPolicy.ts): the owner can change the status, the
// creator and the super admins can change everything. An owner who has left
// the e-board (`needsNewOwner`) can't change anything, so they're left out.
// A creator who has left can't be told apart from here (the board only has
// their name), so they're still named.

import {
  firstName,
  personName,
  type BoardTask,
  type TaskPerson,
} from "./types.ts";

type PermissionTask = Pick<
  BoardTask,
  "ownerId" | "createdById" | "needsNewOwner" | "can"
> & { owner: TaskPerson; createdBy: TaskPerson };

const SUPER_ADMINS = "the president, VP and website lead";

/** Whether an account has a name to show, rather than "Unnamed member". */
function hasName(person: TaskPerson): boolean {
  return !!(person.name?.trim() || person.preferredName?.trim());
}

/** "Priya (the owner)", or "the owner" when the account has no name. */
function labelled(name: string | null, role: string): string {
  return name ? `${name} (${role})` : role;
}

/**
 * Who may change a card the viewer can't, for the kanban's lock: a tooltip,
 * a toast and a screen-reader hint. No closing full stop, the toast adds one.
 */
export function lockedHint(task: PermissionTask): string {
  const ownerActive = !task.needsNewOwner;
  const creatorName = hasName(task.createdBy)
    ? personName(task.createdBy)
    : null;
  const people: string[] = [];

  if (task.ownerId === task.createdById) {
    // An owner who left and made the task leaves only the super admins.
    if (ownerActive)
      people.push(labelled(creatorName, "the owner and creator"));
  } else {
    if (ownerActive) {
      const ownerName = hasName(task.owner) ? firstName(task.owner) : null;
      people.push(labelled(ownerName, "the owner"));
    }
    people.push(labelled(creatorName, "the creator"));
  }

  // The serial comma keeps the last person apart from the list of roles.
  const who =
    people.length === 0
      ? SUPER_ADMINS
      : people.length === 1
        ? `${people[0]} or ${SUPER_ADMINS}`
        : `${people.join(", ")}, or ${SUPER_ADMINS}`;
  return `Only ${who} can change this`;
}

/** The task panel's note to a viewer who can't edit the task. */
export function permissionNote(task: PermissionTask): string {
  const creator = hasName(task.createdBy) ? personName(task.createdBy) : null;

  if (task.can.changeStatus) {
    // The viewer is the owner, but not the creator or a super admin.
    return creator
      ? `You can change the status. Only ${creator}, who created this, or ${SUPER_ADMINS} can change the rest.`
      : `You can change the status. Only the creator or ${SUPER_ADMINS} can change the rest.`;
  }

  const ownerActive = !task.needsNewOwner;
  const samePerson = task.ownerId === task.createdById;
  const sentences = ["This task is read-only for you."];

  if (samePerson && !ownerActive) {
    sentences.push(`Only ${SUPER_ADMINS} can change it.`);
    return sentences.join(" ");
  }

  if (samePerson) {
    sentences.push(
      creator
        ? `${creator}, who owns and created it, and ${SUPER_ADMINS} can change everything.`
        : `The owner, who created it, and ${SUPER_ADMINS} can change everything.`,
    );
    return sentences.join(" ");
  }

  if (ownerActive) {
    sentences.push(
      hasName(task.owner)
        ? `${firstName(task.owner)}, who owns it, can change the status.`
        : "The owner can change the status.",
    );
  }
  sentences.push(
    creator
      ? `${creator}, who created it, and ${SUPER_ADMINS} can change everything.`
      : `The creator and ${SUPER_ADMINS} can change everything.`,
  );
  return sentences.join(" ");
}
