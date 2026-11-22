"use client";

import * as React from "react";
import { LockIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/common/PersonAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TaskStatusValue } from "@/lib/enums";
import {
  DONE_SHOWN,
  KANBAN_COLUMNS,
  dueLabel,
  formatDueLong,
  isKanbanFiltered,
  kanbanColumns,
  type KanbanColumn,
  type KanbanFilters,
} from "@/lib/tasks/board";
import { cn } from "@/lib/utils";
import { ReminderNotDelivered } from "./SlackFlags";
import { meetingDay } from "./TaskRow";
import {
  TaskStatusControl,
  TaskStatusPill,
  taskStatusLabel,
} from "./TaskStatusControl";
import { firstName, personName, type BoardTask } from "./types";

// The kanban view of the Tasks board (#144).
//
// Dragging uses the browser's own drag and drop events: the only drop targets
// are three columns (cards are never reordered by hand, each column sorts
// itself), so a library would add weight without adding much. Dragging is the
// mouse shortcut. The status menu on every card is the way that works
// everywhere: it's the board's native <select>, so it takes the keyboard and
// opens the phone's own picker. Narrow screens show one column at a time,
// with no dragging at all.

const DUE_TONE = {
  overdue: "bg-destructive/10 font-semibold text-destructive",
  today: "bg-warning/15 font-semibold text-warning-foreground",
  soon: "text-foreground",
  later: "text-muted-foreground",
} as const;

const DOT: Record<KanbanColumn, string> = {
  TODO: "bg-muted-foreground",
  IN_PROGRESS: "bg-info",
  DONE: "bg-primary",
};

const statusId = (taskId: number) => `kanban-status-${taskId}`;
const columnId = (col: KanbanColumn) => `kanban-col-${col}`;
// Who can move a locked card, as the task panel's PermissionNote says it:
// the owner, the creator and the super admins. Short, since it's a tooltip,
// a toast and a screen-reader hint.
const lockedHint = (task: BoardTask) => {
  const owner = firstName(task.owner);
  const others =
    task.createdById === task.ownerId
      ? ""
      : `, ${firstName(task.createdBy)} (the creator),`;
  return `Only ${owner}${others} or the president, VP and website lead can change this`;
};

export function TaskKanban({
  tasks,
  today,
  viewerId,
  filters,
  isPending,
  onStatusChange,
  onOpen,
}: {
  tasks: BoardTask[];
  today: string;
  viewerId: number;
  filters: KanbanFilters;
  /** Whether a status change for this task is still saving. */
  isPending: (taskId: number) => boolean;
  onStatusChange: (task: BoardTask, status: TaskStatusValue) => void;
  /** Gets the title button, so focus can go back to it when the panel closes. */
  onOpen: (task: BoardTask, origin: HTMLElement) => void;
}) {
  const columns = kanbanColumns(tasks, filters, viewerId);
  const filtered = isKanbanFiltered(filters);

  // Narrow screens: which column the tabs show.
  const [activeColumn, setActiveColumn] = React.useState<KanbanColumn>("TODO");
  const tabRefs = React.useRef<Partial<Record<KanbanColumn, HTMLElement>>>({});
  const [allDone, setAllDone] = React.useState(false);

  const [dragging, setDragging] = React.useState<BoardTask | null>(null);
  const [dropTarget, setDropTarget] = React.useState<KanbanColumn | null>(null);
  const endDrag = () => {
    setDragging(null);
    setDropTarget(null);
  };

  // A card changed from its menu lands in another column, as a new element.
  // Put focus back on its menu there, or, when that column is hidden behind a
  // tab, on the tab still showing, so a keyboard user isn't dropped to <body>.
  const refocus = React.useRef<{ id: number; status: string } | null>(null);
  React.useLayoutEffect(() => {
    const want = refocus.current;
    if (!want) return;
    const task = tasks.find((t) => t.id === want.id);
    if (!task) {
      refocus.current = null;
      return;
    }
    // Not moved yet: wait for the render that moves it.
    if (task.status !== want.status) return;
    refocus.current = null;
    const select = document.getElementById(statusId(want.id));
    if (select && select.offsetParent !== null) select.focus();
    else tabRefs.current[activeColumn]?.focus();
  });

  const changeFromMenu = (task: BoardTask, status: TaskStatusValue) => {
    refocus.current = { id: task.id, status };
    onStatusChange(task, status);
  };

  const moveTab = (from: KanbanColumn, step: number) => {
    const i = KANBAN_COLUMNS.indexOf(from);
    const next = KANBAN_COLUMNS[(i + step + 3) % 3];
    setActiveColumn(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="@container grid min-w-0 gap-3">
      <div
        role="tablist"
        aria-label="Columns"
        className="flex rounded-full bg-muted p-1 @min-[640px]:hidden"
      >
        {KANBAN_COLUMNS.map((col) => {
          const selected = col === activeColumn;
          const overdue = columns[col].some((t) => t.isOverdue);
          return (
            <button
              key={col}
              ref={(el) => {
                if (el) tabRefs.current[col] = el;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={columnId(col)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveColumn(col)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") moveTab(col, 1);
                else if (e.key === "ArrowLeft") moveTab(col, -1);
                else return;
                e.preventDefault();
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-full px-1.5 py-1 text-[13px] font-medium whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                selected && "bg-card text-foreground shadow-sm",
              )}
            >
              {taskStatusLabel(col)}
              <span className="text-muted-foreground tabular-nums">
                {columns[col].length}
              </span>
              {overdue && (
                <>
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-destructive"
                  />
                  <span className="sr-only">, has overdue tasks</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3.5 @min-[640px]:grid-cols-3">
        {KANBAN_COLUMNS.map((col) => {
          const list = columns[col];
          const overdue = list.filter((t) => t.isOverdue).length;
          const long = col === "DONE" && list.length > DONE_SHOWN;
          const shown = long && !allDone ? list.slice(0, DONE_SHOWN) : list;
          const canDrop =
            dragging !== null &&
            dragging.status !== col &&
            dragging.can.changeStatus;
          return (
            <section
              key={col}
              id={columnId(col)}
              aria-labelledby={`${columnId(col)}-title`}
              onDragOver={(e) => {
                if (!canDrop) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dropTarget !== col) setDropTarget(col);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node | null))
                  return;
                setDropTarget((t) => (t === col ? null : t));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const task = dragging;
                endDrag();
                if (task && canDrop) onStatusChange(task, col);
              }}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-2xl border-[1.5px] border-transparent bg-muted/60 p-2.5 transition-colors motion-reduce:transition-none",
                "@max-[639px]:border-0 @max-[639px]:bg-transparent @max-[639px]:p-0",
                col !== activeColumn && "@max-[639px]:hidden",
                dragging && canDrop && "border-dashed border-input",
                dropTarget === col &&
                  "border-solid border-primary bg-primary/12",
              )}
            >
              <div className="flex min-h-[26px] items-center gap-2 px-1.5 pt-1 @max-[639px]:sr-only">
                <span
                  aria-hidden="true"
                  className={cn("size-2 shrink-0 rounded-full", DOT[col])}
                />
                <h2
                  id={`${columnId(col)}-title`}
                  className="text-sm font-semibold"
                >
                  {taskStatusLabel(col)}
                </h2>
                <span className="rounded-full bg-card px-[7px] text-xs font-semibold text-muted-foreground tabular-nums">
                  {list.length}
                </span>
                {overdue > 0 && (
                  <span className="ml-auto text-xs font-semibold text-destructive tabular-nums">
                    {overdue} overdue
                  </span>
                )}
              </div>

              <ul className="grid gap-2">
                {shown.length > 0 ? (
                  shown.map((task) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      today={today}
                      isMine={task.ownerId === viewerId}
                      pending={isPending(task.id)}
                      dragging={dragging?.id === task.id}
                      onDragStart={() => setDragging(task)}
                      onDragEnd={endDrag}
                      onStatusChange={changeFromMenu}
                      onOpen={onOpen}
                    />
                  ))
                ) : (
                  <li className="rounded-xl border border-dashed border-input p-3.5 text-center text-[13px] text-muted-foreground">
                    {filtered
                      ? "Nothing here with these filters."
                      : col === "DONE"
                        ? "Nothing done yet."
                        : "Nothing here."}
                  </li>
                )}
              </ul>

              {long && (
                <div className="flex flex-col items-center gap-1 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={allDone}
                    onClick={() => setAllDone((v) => !v)}
                    className="text-muted-foreground"
                  >
                    {allDone ? "Show fewer" : `Show all ${list.length} done`}
                  </Button>
                  {!allDone && (
                    <span className="text-center text-xs text-muted-foreground">
                      Showing the {DONE_SHOWN} finished most recently
                    </span>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  today,
  isMine,
  pending,
  dragging,
  onDragStart,
  onDragEnd,
  onStatusChange,
  onOpen,
}: {
  task: BoardTask;
  today: string;
  isMine: boolean;
  pending: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onStatusChange: (task: BoardTask, status: TaskStatusValue) => void;
  onOpen: (task: BoardTask, origin: HTMLElement) => void;
}) {
  const titleRef = React.useRef<HTMLButtonElement>(null);
  const done = task.status === "DONE";
  const due = dueLabel(task, today);
  const can = task.can.changeStatus;
  const name = personName(task.owner);

  return (
    <li
      // Every card can start a drag, so trying to move someone else's says
      // why it won't; theirs is cancelled before anything moves.
      draggable
      onDragStart={(e) => {
        if (!can) {
          e.preventDefault();
          toast(`You can't move this one. ${lockedHint(task)}.`);
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.title);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      // The whole card opens the panel, for a bigger target on phones. The
      // title button is the keyboard's way in.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, select, a")) return;
        if (titleRef.current) onOpen(task, titleRef.current);
      }}
      className={cn(
        "grid min-w-0 cursor-pointer gap-2 rounded-xl border bg-card px-3 py-2.5 text-card-foreground shadow-xs hover:border-input",
        can && "active:cursor-grabbing",
        task.isOverdue && "border-destructive/50 hover:border-destructive/70",
        dragging && "opacity-40",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <button
          ref={titleRef}
          type="button"
          aria-haspopup="dialog"
          onClick={(e) => onOpen(task, e.currentTarget)}
          className={cn(
            "w-fit max-w-full cursor-pointer rounded-sm text-left text-sm leading-snug font-medium [overflow-wrap:anywhere] outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50",
            done &&
              "text-muted-foreground line-through decoration-muted-foreground/60",
          )}
        >
          {task.title}
        </button>
        {can ? (
          <TaskStatusControl
            id={statusId(task.id)}
            status={task.status}
            taskTitle={task.title}
            canChange
            busy={pending}
            onChange={(status) => onStatusChange(task, status)}
          />
        ) : (
          <TaskStatusPill
            status={task.status}
            title={lockedHint(task)}
            className="inline-flex cursor-help items-center gap-1"
            leading={
              <LockIcon aria-hidden="true" className="size-3 opacity-75" />
            }
            srHint={lockedHint(task)}
          />
        )}
      </div>

      {!done &&
        (task.needsNewOwner || task.reminderUndelivered || task.team) && (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {task.needsNewOwner && (
              <Badge variant="warning">
                <TriangleAlertIcon aria-hidden="true" />
                Needs a new owner
              </Badge>
            )}
            <ReminderNotDelivered undelivered={task.reminderUndelivered} />
            {task.team && <Badge variant="muted">{task.team.name}</Badge>}
          </div>
        )}

      <div className="flex min-w-0 items-center justify-between gap-2 text-[12.5px]">
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <span
            aria-hidden="true"
            className="[&_[data-slot=avatar]]:size-[22px] [&_[data-slot=avatar-fallback]]:text-[10px]"
          >
            <PersonAvatar name={name} size="sm" />
          </span>
          <span className="truncate">
            {name}
            {isMine && " (you)"}
          </span>
        </span>
        {done ? (
          <span
            title={`Due ${formatDueLong(task.dueDate)}`}
            className="shrink-0 px-2 font-medium whitespace-nowrap text-muted-foreground tabular-nums"
          >
            Done {meetingDay(task.updatedAt)}
          </span>
        ) : (
          <span
            title={formatDueLong(task.dueDate)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-px font-medium whitespace-nowrap tabular-nums",
              DUE_TONE[due.tone],
            )}
          >
            {due.tone === "overdue" && (
              <TriangleAlertIcon aria-hidden="true" className="size-3" />
            )}
            {due.text}
          </span>
        )}
      </div>
    </li>
  );
}
