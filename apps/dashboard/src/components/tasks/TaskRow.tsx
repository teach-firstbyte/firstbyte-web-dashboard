"use client";

import { TriangleAlertIcon } from "lucide-react";

import { PersonAvatar } from "@/components/common/PersonAvatar";
import { Badge } from "@/components/ui/badge";
import type { TaskStatusValue } from "@/lib/enums";
import { monthAndDay } from "@/lib/format";
import { dueLabel, formatDueLong } from "@/lib/tasks/board";
import { cn } from "@/lib/utils";
import { ReminderNotDelivered } from "./SlackFlags";
import { TaskStatusControl } from "./TaskStatusControl";
import { firstName, personName, type BoardTask } from "./types";

/** "Nov 11", the meeting's day in Boston. */
export function meetingDay(scheduledAt: Date | string): string {
  const { month, day } = monthAndDay(scheduledAt);
  return `${month} ${day}`;
}

/** The due label's colour for each tone. */
export const DUE_TONE = {
  overdue: "font-semibold text-destructive",
  today: "font-semibold text-warning-foreground",
  soon: "text-foreground",
  later: "text-muted-foreground",
} as const;

/**
 * One task on the board: the status control, the title (which opens the
 * detail panel) with its labels, and when it's due.
 */
export function TaskRow({
  task,
  today,
  showOwner,
  showTeam,
  statusPending,
  onStatusChange,
  onOpen,
}: {
  task: BoardTask;
  today: string;
  /** In groups that aren't one person's: needs a new owner, by team. */
  showOwner: boolean;
  /** Off when the group already is the team. */
  showTeam: boolean;
  statusPending: boolean;
  onStatusChange: (task: BoardTask, status: TaskStatusValue) => void;
  /** Gets the title button, so focus can go back to it when the panel closes. */
  onOpen: (task: BoardTask, origin: HTMLElement) => void;
}) {
  const done = task.status === "DONE";
  const due = dueLabel(task, today);

  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)] gap-x-3.5 gap-y-1.5 border-b px-3.5 py-3 last:border-b-0 sm:grid-cols-[124px_minmax(0,1fr)_auto] sm:items-start sm:px-[18px] sm:py-[11px]",
      )}
    >
      <div>
        <TaskStatusControl
          status={task.status}
          taskTitle={task.title}
          canChange={task.can.changeStatus}
          readOnlyHint={`Only ${firstName(task.owner)} or the creator can change this`}
          disabled={statusPending}
          onChange={(status) => onStatusChange(task, status)}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(e) => onOpen(task, e.currentTarget)}
          className={cn(
            "w-fit max-w-full cursor-pointer rounded-sm text-left text-[14.5px] font-medium [overflow-wrap:anywhere] outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50",
            done &&
              "text-muted-foreground line-through decoration-muted-foreground/60",
          )}
        >
          {task.title}
        </button>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {showOwner && (
            <Badge variant="muted" className="gap-1.5 pl-0.5">
              <span className="[&_[data-slot=avatar]]:size-[18px] [&_[data-slot=avatar-fallback]]:text-[9px]">
                <PersonAvatar name={personName(task.owner)} size="sm" />
              </span>
              {personName(task.owner)}
            </Badge>
          )}
          {task.needsNewOwner && !done && (
            <Badge variant="warning">
              <TriangleAlertIcon aria-hidden="true" />
              Needs a new owner
            </Badge>
          )}
          {showTeam && task.team && (
            <Badge variant="muted">{task.team.name}</Badge>
          )}
          {task.meeting && (
            <Badge
              variant="outline"
              className="font-normal text-muted-foreground"
            >
              From {meetingDay(task.meeting.scheduledAt)} meeting
            </Badge>
          )}
          <ReminderNotDelivered undelivered={task.reminderUndelivered} />
          {task.notes && (
            <span
              title={task.notes}
              className="max-w-full min-w-0 truncate text-xs text-muted-foreground"
            >
              {task.notes}
            </span>
          )}
        </div>
      </div>

      <div
        title={formatDueLong(task.dueDate)}
        className={cn(
          "text-[13px] font-medium whitespace-nowrap tabular-nums sm:pt-[3px] sm:text-right",
          DUE_TONE[due.tone],
        )}
      >
        {due.text}
      </div>
    </li>
  );
}
