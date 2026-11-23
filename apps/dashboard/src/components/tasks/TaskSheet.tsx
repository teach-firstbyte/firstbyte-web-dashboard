"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import {
  TASK_STATUS,
  TASK_STATUS_OPTIONS,
  type TaskStatusValue,
} from "@/lib/enums";
import { formatIsoDate, formatShortDate } from "@/lib/format";
import { formatDueLong, formatDueShort } from "@/lib/tasks/board";
import { ownerTeamId } from "@/lib/tasks/owners";
import { DUE_HELP, describeDue, parseDue } from "@/lib/tasks/parseDue";
import { createTask, deleteTask, updateTask, type TaskInput } from "./api";
import { OwnerCombobox } from "./OwnerCombobox";
import { ReminderNotDelivered } from "./SlackFlags";
import { taskStatusLabel } from "./TaskStatusControl";
import { permissionNote } from "./permissionText";
import { personName, type BoardTask, type TaskFormOptions } from "./types";

/** What the panel is showing: the New task form, or one task. */
export type TaskPanel = { kind: "new" } | { kind: "task"; task: BoardTask };

type FormState = {
  title: string;
  ownerId: string;
  /** What's typed in the owner box. `ownerId` is who it resolved to. */
  ownerText: string;
  /** "YYYY-MM-DD", or "" while `dueText` can't be read. */
  dueDate: string;
  /** What's typed in the due box: "fri", "12/4", "next week". */
  dueText: string;
  status: TaskStatusValue;
  teamId: string;
  meetingId: string;
  notes: string;
};

const BLANK: FormState = {
  title: "",
  ownerId: "",
  ownerText: "",
  dueDate: "",
  dueText: "",
  status: TASK_STATUS.TODO,
  teamId: "",
  meetingId: "",
  notes: "",
};

/** "2026-12-04" -> "12/4/26", which parseDue reads back as that exact day. */
function dueTextFor(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

function fromTask(t: BoardTask): FormState {
  return {
    title: t.title,
    ownerId: String(t.ownerId),
    ownerText:
      personName(t.owner) + (t.needsNewOwner ? " (left the e-board)" : ""),
    dueDate: t.dueDate,
    dueText: dueTextFor(t.dueDate),
    status: t.status,
    teamId: t.teamId ? String(t.teamId) : "",
    meetingId: t.meetingId ? String(t.meetingId) : "",
    notes: t.notes ?? "",
  };
}

function toInput(f: FormState): TaskInput {
  return {
    title: f.title.trim(),
    ownerId: Number(f.ownerId),
    dueDate: f.dueDate,
    status: f.status,
    teamId: f.teamId ? Number(f.teamId) : null,
    meetingId: f.meetingId ? Number(f.meetingId) : null,
    notes: f.notes.trim() || null,
  };
}

/** Only the fields that differ from the task, so the owner sends status alone. */
function changesFrom(task: BoardTask, next: TaskInput, canEdit: boolean) {
  const before = toInput(fromTask(task));
  const changes: Partial<TaskInput> = {};
  const keys = canEdit
    ? (Object.keys(next) as (keyof TaskInput)[])
    : (["status"] as const);
  for (const key of keys) {
    if (next[key] !== before[key]) {
      (changes as Record<string, unknown>)[key] = next[key];
    }
  }
  return changes;
}

/**
 * The right-hand panel for one task, and the New task form.
 *
 * Follows `task.can` to the letter: fields only the creator or a super admin
 * may change are shown as text for everyone else, with a note saying who
 * can; the status stays a control for the owner; and Delete asks again in
 * the panel's own footer before anything is removed.
 *
 * The owner and due fields are the same as on the meeting page's Action
 * items: the owner combobox matches names and roles ("events"), and the due
 * box reads "fri", "next week" or "12/4", with the date it picked shown
 * underneath.
 */
export function TaskSheet({
  panel,
  options,
  onOpenChange,
  onCloseAutoFocus,
}: {
  panel: TaskPanel | null;
  options: TaskFormOptions;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  // Radix keeps the panel mounted while it slides out, after `panel` has gone
  // null. Holding the last one keeps the body from blanking mid-animation.
  const [lingering, setLingering] = React.useState(panel);
  if (panel !== null && panel !== lingering) setLingering(panel);
  const shown = panel ?? lingering;

  const isNew = shown?.kind === "new";
  const task = shown?.kind === "task" ? shown.task : null;

  return (
    <Sheet open={panel !== null} onOpenChange={onOpenChange}>
      <SheetContent
        onCloseAutoFocus={onCloseAutoFocus}
        // Opening a task is usually to read it. Radix would focus the title
        // field, which selects it and brings up a phone's keyboard, so focus
        // the panel itself. The New task form keeps focus on its title.
        onOpenAutoFocus={(event) => {
          if (panel?.kind !== "task") return;
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        {shown && (
          <>
            <SheetHeader>
              <SheetTitle>{isNew ? "New task" : "Task"}</SheetTitle>
              <SheetDescription>
                {isNew
                  ? "The owner sees it on the board and their Home page."
                  : task &&
                    `Created by ${personName(task.createdBy)} on ${formatDueShort(formatIsoDate(task.createdAt))}`}
              </SheetDescription>
            </SheetHeader>
            <TaskForm
              // A fresh form for each task, and again after a save brings
              // back a newer copy of it.
              key={task ? `${task.id}-${String(task.updatedAt)}` : "new"}
              task={task}
              options={options}
              onDone={() => onOpenChange(false)}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskForm({
  task,
  options,
  onDone,
}: {
  task: BoardTask | null;
  options: TaskFormOptions;
  onDone: () => void;
}) {
  const router = useRouter();
  const save = useAsyncAction();
  const remove = useAsyncAction();
  const [form, setForm] = React.useState<FormState>(() =>
    task ? fromTask(task) : BLANK,
  );
  const [touched, setTouched] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  const isNew = task === null;
  const canEdit = isNew || task.can.edit;
  const canStatus = isNew || task.can.changeStatus;
  const canDelete = !isNew && task.can.delete;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const titleError =
    touched && !form.title.trim() ? "Give the task a title." : null;
  const ownerError =
    touched && !form.ownerId
      ? form.ownerText.trim()
        ? "Pick someone from the list."
        : "Pick an owner."
      : null;
  const dueError =
    touched && !form.dueDate
      ? form.dueText.trim()
        ? `Can't read that date. ${DUE_HELP}.`
        : "Type a due date, like fri or 12/4."
      : null;
  const dueHint = form.dueDate
    ? describeDue(form.dueDate)
    : form.dueText.trim()
      ? DUE_HELP
      : "fri, tomorrow, next week, +3d, 12/4 or nov 30";

  // A task keeps showing its team and meeting even when they've dropped off
  // the pickers' lists (archived, older). An owner who left the e-board stays
  // as the typed text and id until someone picks a new one.
  const teamOptions = [...options.teams];
  if (task?.team && !teamOptions.some((t) => t.id === task.team!.id)) {
    teamOptions.push(task.team);
  }
  const meetingOptions = [...options.meetings];
  if (task?.meeting && !meetingOptions.some((m) => m.id === task.meeting!.id)) {
    meetingOptions.push(task.meeting);
  }
  const meetingLabel = (m: { title: string; scheduledAt: Date | string }) =>
    `${m.title}, ${formatShortDate(m.scheduledAt)}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (canEdit && (!form.title.trim() || !form.ownerId || !form.dueDate))
      return;

    save.run(async () => {
      const input = toInput(form);
      if (isNew) {
        await createTask(input);
        router.refresh();
        onDone();
        toast(`Added “${input.title}”`);
        return;
      }
      const changes = changesFrom(task, input, task.can.edit);
      if (Object.keys(changes).length === 0) {
        onDone();
        return;
      }
      await updateTask(task.id, changes);
      router.refresh();
      onDone();
      toast("Changes saved");
    });
  };

  const confirmDelete = () =>
    remove.run(async () => {
      await deleteTask(task!.id);
      router.refresh();
      onDone();
      toast(`Deleted “${task!.title}”`);
    });

  const readOnly = (value: React.ReactNode) => (
    <p className="py-1.5 text-sm font-medium [overflow-wrap:anywhere]">
      {value}
    </p>
  );

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody className="space-y-0">
        <FieldGroup className="gap-5">
          {!canEdit && task && <PermissionNote task={task} />}

          <Field data-invalid={!!titleError || undefined}>
            <FieldLabel htmlFor="task-title">Title</FieldLabel>
            {canEdit ? (
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Book a room for the December GBM"
                maxLength={200}
                aria-invalid={!!titleError}
                autoFocus={isNew}
              />
            ) : (
              readOnly(task?.title)
            )}
            {titleError && <FieldError>{titleError}</FieldError>}
          </Field>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2 sm:gap-3">
            <Field data-invalid={!!ownerError || undefined}>
              <FieldLabel htmlFor="task-owner">Owner</FieldLabel>
              {canEdit ? (
                <OwnerCombobox
                  id="task-owner"
                  owners={options.owners}
                  value={form.ownerId ? Number(form.ownerId) : null}
                  onValueChange={(owner) =>
                    setForm((prev) => ({
                      ...prev,
                      ownerId: owner ? String(owner.id) : "",
                      // A new task takes the owner's team, like the meeting
                      // page does, unless a team is already picked.
                      teamId:
                        isNew && owner && !prev.teamId
                          ? String(ownerTeamId(owner) ?? "")
                          : prev.teamId,
                    }))
                  }
                  inputValue={form.ownerText}
                  onInputValueChange={(text) => set("ownerText", text)}
                  placeholder="Name or role, like events"
                  aria-invalid={!!ownerError}
                />
              ) : (
                readOnly(task && personName(task.owner))
              )}
              {ownerError && <FieldError>{ownerError}</FieldError>}
            </Field>

            <Field data-invalid={!!dueError || undefined}>
              <FieldLabel htmlFor="task-due">Due</FieldLabel>
              {canEdit ? (
                <Input
                  id="task-due"
                  value={form.dueText}
                  onChange={(e) => {
                    const dueText = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      dueText,
                      dueDate: parseDue(dueText) ?? "",
                    }));
                  }}
                  placeholder="fri, 12/4, next week"
                  autoComplete="off"
                  aria-invalid={!!dueError}
                  aria-describedby="task-due-hint"
                />
              ) : (
                readOnly(task && formatDueLong(task.dueDate))
              )}
              {dueError ? (
                <FieldError>{dueError}</FieldError>
              ) : (
                canEdit && (
                  <FieldDescription
                    id="task-due-hint"
                    className={form.dueDate ? "text-primary" : undefined}
                  >
                    {dueHint}
                  </FieldDescription>
                )
              )}
            </Field>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2 sm:gap-3">
            <Field>
              <FieldLabel htmlFor="task-status">Status</FieldLabel>
              {canStatus ? (
                <NativeSelect
                  id="task-status"
                  data-full
                  value={form.status}
                  onChange={(e) =>
                    set("status", e.target.value as TaskStatusValue)
                  }
                >
                  {TASK_STATUS_OPTIONS.map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : (
                readOnly(task && taskStatusLabel(task.status))
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="task-team">Team</FieldLabel>
              {canEdit ? (
                <NativeSelect
                  id="task-team"
                  data-full
                  value={form.teamId}
                  onChange={(e) => set("teamId", e.target.value)}
                >
                  <NativeSelectOption value="">No team</NativeSelectOption>
                  {teamOptions.map((t) => (
                    <NativeSelectOption key={t.id} value={t.id}>
                      {t.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : (
                readOnly(task?.team?.name ?? "No team")
              )}
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="task-meeting">From meeting</FieldLabel>
            {canEdit ? (
              <NativeSelect
                id="task-meeting"
                data-full
                value={form.meetingId}
                onChange={(e) => set("meetingId", e.target.value)}
              >
                <NativeSelectOption value="">
                  Not from a meeting
                </NativeSelectOption>
                {meetingOptions.map((m) => (
                  <NativeSelectOption key={m.id} value={m.id}>
                    {meetingLabel(m)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              readOnly(
                task?.meeting
                  ? meetingLabel(task.meeting)
                  : "Not from a meeting",
              )
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="task-notes">Notes</FieldLabel>
            {canEdit ? (
              <Textarea
                id="task-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Context, links, who you're waiting on"
                rows={3}
                maxLength={5000}
              />
            ) : task?.notes ? (
              <p className="py-1.5 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                {task.notes}
              </p>
            ) : (
              <p className="py-1.5 text-sm text-muted-foreground">No notes</p>
            )}
          </Field>

          <ReminderNotDelivered undelivered={task?.reminderUndelivered} />

          {save.error && (
            <p className="text-sm text-destructive">{save.error}</p>
          )}
        </FieldGroup>
      </SheetBody>

      <SheetFooter className="flex-wrap items-center p-5">
        {confirmingDelete && task ? (
          <div className="flex w-full flex-col gap-3" role="alert">
            <p className="text-sm">
              <b className="font-semibold">Delete “{task.title}”?</b> It&apos;s
              removed for everyone and its reminders stop. This can&apos;t be
              undone.
            </p>
            {remove.error && (
              <p className="text-sm text-destructive">{remove.error}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                pending={remove.pending}
                pendingLabel="Deleting…"
                onClick={confirmDelete}
              >
                Delete task
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={remove.pending}
                onClick={() => setConfirmingDelete(false)}
                autoFocus
              >
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <>
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
            )}
            <span className="flex-1" />
            <Button
              type="button"
              variant="outline"
              onClick={onDone}
              disabled={save.pending}
            >
              {canStatus ? "Cancel" : "Close"}
            </Button>
            {canStatus && (
              <Button
                type="submit"
                pending={save.pending}
                pendingLabel="Saving…"
              >
                {isNew ? "Add task" : "Save"}
              </Button>
            )}
          </>
        )}
      </SheetFooter>
    </form>
  );
}

/** Says who can change what, for anyone who can't edit this task. */
function PermissionNote({ task }: { task: BoardTask }) {
  return (
    <p className="rounded-xl bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
      {permissionNote(task)}
    </p>
  );
}
