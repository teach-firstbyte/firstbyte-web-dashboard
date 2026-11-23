"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EmptyState, RowList, Section } from "@/components/common/Section";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { TaskStatusValue } from "@/lib/enums";
import { dueLabel, formatDueLong } from "@/lib/tasks/board";
import { cn } from "@/lib/utils";
import type { HomeTasks } from "@/server/tasks/home";
import { updateTask } from "./api";
import { DUE_TONE } from "./TaskRow";
import { TaskStatusControl, taskStatusLabel } from "./TaskStatusControl";
import type { TaskView } from "./types";

/**
 * The My tasks card on Home, for e-board members and super admins: their own
 * tasks that are overdue or due this week, each with its status control.
 *
 * A status change shows at once and goes through PATCH /api/tasks/[id], as on
 * the board, then router.refresh() so the card is the server's answer. A task
 * marked Done drops off on that refresh.
 */
export function MyTasksCard({ data }: { data: HomeTasks }) {
  const allTasks = (
    <Button asChild variant="link" size="sm" className="h-auto p-0">
      <Link href="/tasks">All tasks →</Link>
    </Button>
  );

  if (data.kind === "unavailable") {
    return (
      <Section title="My tasks" action={allTasks}>
        <Banner variant="warning">
          Could not load your tasks right now. Try again in a moment.
        </Banner>
      </Section>
    );
  }

  return (
    <Section title="My tasks" count={data.overdue} action={allTasks}>
      <MyTaskList tasks={data.tasks} today={data.today} />
      {data.later > 0 && (
        <p className="text-sm text-muted-foreground">
          {data.later} more due later.
        </p>
      )}
    </Section>
  );
}

function MyTaskList({ tasks, today }: { tasks: TaskView[]; today: string }) {
  const router = useRouter();
  const statusSave = useAsyncAction();
  const [shown, setOptimisticStatus] = React.useOptimistic(
    tasks,
    (state, change: { id: number; status: TaskStatusValue }) =>
      state.map((t) =>
        t.id === change.id ? { ...t, status: change.status } : t,
      ),
  );

  const changeStatus = (task: TaskView, status: TaskStatusValue) => {
    const previous = task.status;
    if (status === previous) return;
    statusSave.run(async () => {
      setOptimisticStatus({ id: task.id, status });
      try {
        await updateTask(task.id, { status });
        router.refresh();
        toast(`${taskStatusLabel(status)}: ${task.title}`, {
          description:
            status === "DONE"
              ? "Reminders for this task stop."
              : previous === "DONE"
                ? "Reminders pick up again from the due date."
                : undefined,
          action: {
            label: "Undo",
            onClick: () => changeStatus({ ...task, status }, previous),
          },
        });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "That change didn't save.",
        );
      }
    }, task.id);
  };

  if (shown.length === 0) {
    return (
      <EmptyState title="Nothing due. You're clear.">
        New tasks from e-board meetings show up here.
      </EmptyState>
    );
  }

  return (
    <RowList>
      {shown.map((task) => {
        const due = dueLabel(task, today);
        return (
          <li
            key={task.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2.5"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "text-[14.5px] font-medium [overflow-wrap:anywhere]",
                  task.status === "DONE" &&
                    "text-muted-foreground line-through decoration-muted-foreground/60",
                )}
              >
                {task.title}
              </span>
              <span
                title={formatDueLong(task.dueDate)}
                className={cn(
                  "w-fit text-[13px] font-medium tabular-nums",
                  DUE_TONE[due.tone],
                )}
              >
                {due.text}
              </span>
            </div>
            <div className="w-[124px]">
              <TaskStatusControl
                status={task.status}
                taskTitle={task.title}
                canChange={task.can.changeStatus}
                readOnlyHint="Only the owner or the creator can change this"
                disabled={statusSave.isPendingKey(task.id)}
                onChange={(status) => changeStatus(task, status)}
              />
            </div>
          </li>
        );
      })}
    </RowList>
  );
}
