"use client";

import type * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { TASK_STATUS_OPTIONS, type TaskStatusValue } from "@/lib/enums";
import { cn } from "@/lib/utils";

/** The tint for each status: grey, blue, green, as in the mockup. */
const TONE: Record<string, string> = {
  TODO: "bg-muted text-foreground",
  IN_PROGRESS: "bg-info/12 text-info",
  DONE: "bg-primary/12 text-primary",
};

export function taskStatusLabel(status: string): string {
  return TASK_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

/** A status as a read-only pill, for people who can't change it. */
export function TaskStatusPill({
  status,
  title,
  className,
  leading,
  srHint,
}: {
  status: string;
  title?: string;
  className?: string;
  /** An icon before the label, like the lock on a card you can't move. */
  leading?: React.ReactNode;
  /** Why it is read-only, for screen readers (the title is hover-only). */
  srHint?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold whitespace-nowrap",
        TONE[status],
        className,
      )}
    >
      {leading}
      {taskStatusLabel(status)}
      {srHint && <span className="sr-only">. {srHint}</span>}
    </span>
  );
}

/**
 * The inline status control on each row: a native select dressed as the
 * status pill, so it keeps the phone's own picker and full keyboard support.
 * Shows a plain pill instead when `canChange` is false.
 */
export function TaskStatusControl({
  id,
  status,
  taskTitle,
  canChange,
  readOnlyHint,
  disabled,
  busy,
  onChange,
}: {
  /** For finding the control again, as the kanban does after a card moves. */
  id?: string;
  status: string;
  /** For the screen-reader label, "Status of Book a room". */
  taskTitle: string;
  canChange: boolean;
  /** Why it is read-only, shown on hover. */
  readOnlyHint?: string;
  disabled?: boolean;
  /**
   * Saving, without disabling: a disabled select drops keyboard focus, and
   * the kanban keeps focus on it while the card moves. A repeat change is
   * ignored by the caller while one is in flight.
   */
  busy?: boolean;
  onChange: (status: TaskStatusValue) => void;
}) {
  if (!canChange) {
    return <TaskStatusPill status={status} title={readOnlyHint} />;
  }

  return (
    // The tint sits on the wrapper so the chevron takes the same colour.
    <div
      className={cn(
        "relative w-full max-w-[140px] rounded-full sm:max-w-none",
        TONE[status],
      )}
    >
      <select
        id={id}
        aria-label={`Status of ${taskTitle}`}
        aria-busy={busy || undefined}
        value={status}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TaskStatusValue)}
        className={cn(
          "w-full cursor-pointer appearance-none rounded-full border border-transparent bg-transparent py-0.5 pr-7 pl-2.5 text-[12.5px] font-semibold transition-[color,box-shadow] outline-none disabled:cursor-wait disabled:opacity-70 aria-busy:cursor-wait aria-busy:opacity-70",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        )}
      >
        {TASK_STATUS_OPTIONS.map((o) => (
          <option
            key={o.value}
            value={o.value}
            className="bg-[Canvas] text-[CanvasText]"
          >
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2"
      />
    </div>
  );
}
