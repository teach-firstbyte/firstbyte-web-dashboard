// The shapes the Tasks components share. Type-only imports from the server
// layer: they are erased at build time, so no server code reaches the bundle.
import type { BoardMeeting, BoardOwner, BoardTeam } from "@/server/tasks/board";
import type { TaskView } from "@/server/tasks/queries";

export type { BoardMeeting, BoardOwner, BoardTeam, TaskView };

/** A task as the board holds it. */
export type BoardTask = TaskView;

/**
 * Someone a task names: its owner or its creator. Only the naming fields, so a
 * creator (who carries no Slack status) fits as well as an owner.
 */
export type TaskPerson = Pick<
  TaskView["owner"],
  "id" | "name" | "preferredName"
>;

/** A person's full name, for headers and labels. Names are optional on accounts. */
export function personName(person: TaskPerson): string {
  return (
    person.name?.trim() || person.preferredName?.trim() || "Unnamed member"
  );
}

/** The first name to use in a sentence: "Only Maya can…". */
export function firstName(person: TaskPerson): string {
  return person.preferredName?.trim() || personName(person).split(/\s+/)[0];
}

/** The options the New task form and the detail panel pick from. */
export type TaskFormOptions = {
  owners: BoardOwner[];
  teams: BoardTeam[];
  meetings: BoardMeeting[];
};
