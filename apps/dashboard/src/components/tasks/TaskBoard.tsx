"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/common/PersonAvatar";
import { EmptyState, PageHeader } from "@/components/common/Section";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Toggle } from "@/components/ui/toggle";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { TaskStatusValue } from "@/lib/enums";
import {
  filtersToQuery,
  groupTasks,
  isKanbanFiltered,
  ownerFilterParam,
  summarize,
  type BoardGroup,
  type BoardSettings,
  type KanbanFilters,
} from "@/lib/tasks/board";
import { cn } from "@/lib/utils";
import { updateTask } from "./api";
import { NotConnectedToSlack } from "./SlackFlags";
import { TaskKanban } from "./TaskKanban";
import { TaskRow } from "./TaskRow";
import { TaskSheet, type TaskPanel } from "./TaskSheet";
import { taskStatusLabel } from "./TaskStatusControl";
import {
  personName,
  type BoardMeeting,
  type BoardOwner,
  type BoardTask,
  type BoardTeam,
} from "./types";

type PanelState = { kind: "new" } | { kind: "task"; id: number } | null;

/**
 * The Tasks board: the summary line, the Board | List switch, each view's
 * filters, and the columns (TaskKanban) or the groups.
 *
 * Reads come from the server page; every write goes through /api/tasks and
 * then router.refresh(), so the board is always the server's answer. A
 * status change shows at once (useOptimistic) and settles when the refresh
 * lands.
 *
 * The view settings live in the URL (filtersToQuery in lib/tasks/board.ts).
 * "Only mine" starts on for regular members and off for super admins; picking
 * a person or a team on the Board turns it off, so it shows who you picked.
 */
export function TaskBoard({
  tasks,
  owners,
  teams,
  meetings,
  today,
  viewerId,
  canManageSlack,
  viewerIsSuperAdmin,
  initialFilters,
}: {
  tasks: BoardTask[];
  owners: BoardOwner[];
  teams: BoardTeam[];
  meetings: BoardMeeting[];
  today: string;
  viewerId: number;
  /** A super admin, who gets the link to Slack setup. Decided on the server. */
  canManageSlack: boolean;
  /** Decides "Only mine"'s default, and so what the URL leaves out. */
  viewerIsSuperAdmin: boolean;
  initialFilters: BoardSettings;
}) {
  const router = useRouter();
  const [filters, setFilters] = React.useState(initialFilters);
  const [panel, setPanel] = React.useState<PanelState>(null);
  const origin = React.useRef<HTMLElement | null>(null);
  const statusSave = useAsyncAction();

  const [shownTasks, setOptimisticStatus] = React.useOptimistic(
    tasks,
    (state, change: { id: number; status: TaskStatusValue }) =>
      // updatedAt too, so a card moved to Done sorts to the top of it.
      state.map((t) =>
        t.id === change.id
          ? { ...t, status: change.status, updatedAt: new Date() }
          : t,
      ),
  );

  const updateFilters = (next: Partial<BoardSettings>) => {
    const merged = { ...filters, ...next };
    setFilters(merged);
    // Not router.replace: nothing on the server changes, so there is
    // nothing to fetch. Next keeps useSearchParams in step with this.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${filtersToQuery(merged, viewerIsSuperAdmin)}`,
    );
  };

  const changeStatus = (task: BoardTask, status: TaskStatusValue) => {
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

  const openTask = (task: BoardTask, from: HTMLElement) => {
    origin.current = from;
    setPanel({ kind: "task", id: task.id });
  };
  const openNew = (e: React.MouseEvent<HTMLElement>) => {
    origin.current = e.currentTarget;
    setPanel({ kind: "new" });
  };

  // The panel reads the server's copy, so a save that refreshes the board
  // can't leave it showing stale fields. A deleted task closes it.
  const panelTask =
    panel?.kind === "task"
      ? (tasks.find((t) => t.id === panel.id) ?? null)
      : null;
  const sheetPanel: TaskPanel | null =
    panel?.kind === "new"
      ? { kind: "new" }
      : panelTask
        ? { kind: "task", task: panelTask }
        : null;

  const summary = summarize(shownTasks, today);
  const groups = groupTasks(shownTasks, {
    filters,
    viewerId,
    ownerIds: owners.map((o) => o.id),
    teamIds: teams.map((t) => t.id),
  });
  const anything = groups.some((g) => g.tasks.length > 0);
  const kanbanFilters: KanbanFilters = {
    mine: filters.mine,
    ownerId: filters.ownerId,
    teamId: filters.teamId,
  };

  const ownerById = new Map(owners.map((o) => [o.id, o]));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  return (
    <>
      <PageHeader
        title="Tasks"
        description={<Summary summary={summary} />}
        action={
          <Button onClick={openNew} aria-haspopup="dialog">
            <PlusIcon aria-hidden="true" />
            New task
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="View"
          value={filters.view}
          onValueChange={(view) => updateFilters({ view })}
          options={[
            { value: "board", label: "Board" },
            { value: "list", label: "List" },
          ]}
        />
        {filters.view === "board" ? (
          <>
            <FilterSelect
              label="Person"
              active={filters.mine || filters.ownerId !== null}
              value={
                filters.mine
                  ? "mine"
                  : (ownerFilterParam(filters.ownerId) ?? "")
              }
              // Picking anyone, Everyone included, turns "Only mine" off.
              onChange={(value) => {
                if (value === "mine") return;
                updateFilters({
                  mine: false,
                  ownerId:
                    value === ""
                      ? null
                      : value === "needs-owner"
                        ? "needsOwner"
                        : Number(value),
                });
              }}
            >
              <NativeSelectOption value="">Everyone</NativeSelectOption>
              {filters.mine && (
                <NativeSelectOption value="mine">You</NativeSelectOption>
              )}
              {owners.map((o) => (
                <NativeSelectOption key={o.id} value={String(o.id)}>
                  {personName(o)}
                  {o.id === viewerId ? " (you)" : ""}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value="needs-owner">
                Needs a new owner
              </NativeSelectOption>
            </FilterSelect>
            <FilterSelect
              label="Team"
              active={filters.teamId !== null}
              value={filters.teamId === null ? "" : String(filters.teamId)}
              // Picking a team shows everyone's tasks in it. "Only mine" can
              // be turned back on after, for just yours.
              onChange={(value) =>
                updateFilters(
                  value === ""
                    ? { teamId: null }
                    : {
                        mine: false,
                        teamId: value === "none" ? "none" : Number(value),
                      },
                )
              }
            >
              <NativeSelectOption value="">All teams</NativeSelectOption>
              {teams.map((t) => (
                <NativeSelectOption key={t.id} value={String(t.id)}>
                  {t.name}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value="none">No team</NativeSelectOption>
            </FilterSelect>
            <FilterToggle
              pressed={filters.mine}
              onPressedChange={(mine) => updateFilters({ mine })}
            >
              Only mine
            </FilterToggle>
            {isKanbanFiltered(kanbanFilters) && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() =>
                  updateFilters({ mine: false, ownerId: null, teamId: null })
                }
              >
                Clear filters
              </Button>
            )}
          </>
        ) : (
          <>
            <Segmented
              label="Group by"
              value={filters.groupBy}
              onValueChange={(groupBy) => updateFilters({ groupBy })}
              options={[
                { value: "owner", label: "By person" },
                { value: "team", label: "By team" },
              ]}
            />
            <FilterToggle
              pressed={filters.mine}
              onPressedChange={(mine) => updateFilters({ mine })}
            >
              Only mine
            </FilterToggle>
            <FilterToggle
              pressed={filters.showDone}
              onPressedChange={(showDone) => updateFilters({ showDone })}
            >
              Show done
            </FilterToggle>
          </>
        )}
        {canManageSlack && (
          <Button
            asChild
            variant="link"
            size="sm"
            className="ml-auto h-auto p-0"
          >
            <Link href="/tasks/slack">Slack setup →</Link>
          </Button>
        )}
      </div>

      {filters.view === "board" ? (
        <TaskKanban
          tasks={shownTasks}
          today={today}
          viewerId={viewerId}
          filters={kanbanFilters}
          isPending={statusSave.isPendingKey}
          onStatusChange={changeStatus}
          onOpen={openTask}
        />
      ) : anything ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
          {groups.map((group) => (
            <GroupCard
              key={group.key}
              group={group}
              head={groupHead(group, { ownerById, teamById, viewerId })}
            >
              {group.tasks.length > 0 ? (
                <ul className="border-t">
                  {group.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      today={today}
                      showOwner={group.kind !== "owner"}
                      showTeam={group.kind !== "team"}
                      statusPending={statusSave.isPendingKey(task.id)}
                      onStatusChange={changeStatus}
                      onOpen={openTask}
                    />
                  ))}
                </ul>
              ) : (
                <p className="px-3.5 pb-3 text-[13px] text-muted-foreground sm:pr-[18px] sm:pl-[58px]">
                  Nothing open.
                </p>
              )}
            </GroupCard>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            title={filters.mine ? "You have no open tasks." : "No open tasks."}
          >
            Add one from an e-board meeting or with New task.
          </EmptyState>
        </div>
      )}

      <TaskSheet
        panel={sheetPanel}
        options={{ owners, teams, meetings }}
        onOpenChange={(open) => !open && setPanel(null)}
        onCloseAutoFocus={(event) => {
          const el = origin.current;
          if (!el || !el.isConnected) return;
          event.preventDefault();
          el.focus();
        }}
      />
    </>
  );
}

function Summary({ summary }: { summary: ReturnType<typeof summarize> }) {
  const n = (value: number, className?: string) => (
    <b className={cn("font-semibold text-foreground tabular-nums", className)}>
      {value}
    </b>
  );
  return (
    <span className="flex flex-wrap gap-x-[18px] gap-y-1.5">
      <span>{n(summary.open)} open</span>
      <span>
        {n(
          summary.overdue,
          summary.overdue > 0 ? "text-destructive" : undefined,
        )}{" "}
        overdue
      </span>
      <span>{n(summary.dueThisWeek)} due this week</span>
      {summary.needsNewOwner > 0 && (
        <span>{n(summary.needsNewOwner)} need a new owner</span>
      )}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  active,
  disabled,
  onChange,
  children,
}: {
  label: string;
  value: string;
  /** Narrowing the board: tinted like a pressed toggle. */
  active: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <NativeSelect
      size="sm"
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "max-w-[60vw] rounded-full bg-card pl-3 text-[13px] font-medium dark:bg-card",
        active &&
          "border-transparent bg-primary/12 text-primary dark:bg-primary/12",
      )}
    >
      {children}
    </NativeSelect>
  );
}

function FilterToggle({
  pressed,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={pressed}
      onPressedChange={onPressedChange}
      className="rounded-full bg-card px-3 text-muted-foreground data-[state=on]:border-transparent data-[state=on]:bg-primary/12 data-[state=on]:text-primary"
    >
      {children}
    </Toggle>
  );
}

type HeadContext = {
  ownerById: Map<number, BoardOwner>;
  teamById: Map<number, BoardTeam>;
  viewerId: number;
};

function groupHead(
  group: BoardGroup<BoardTask>,
  ctx: HeadContext,
): React.ReactNode {
  if (group.kind === "needsOwner") {
    return (
      <>
        <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-warning/15 text-warning-foreground">
          <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
        </span>
        <GroupName
          name="Needs a new owner"
          subtitle="The owner left the e-board. Reminders are paused until it's reassigned."
        />
      </>
    );
  }

  if (group.kind === "team") {
    const team = group.teamId === null ? null : ctx.teamById.get(group.teamId);
    const fallback = group.tasks[0]?.team?.name ?? "Team";
    return (
      <GroupName
        name={group.teamId === null ? "No team" : (team?.name ?? fallback)}
        subtitle={
          group.teamId === null ? "Tasks with no team label" : "Team label"
        }
      />
    );
  }

  const owner = ctx.ownerById.get(group.ownerId);
  const person = owner ?? group.tasks[0]?.owner;
  const name = person ? personName(person) : "You";
  return (
    <>
      <PersonAvatar name={name} size="sm" />
      <GroupName
        name={`${name}${group.ownerId === ctx.viewerId ? " (you)" : ""}`}
        subtitle={owner?.subtitle ?? "E-board"}
      />
      <NotConnectedToSlack linked={person?.slackConnected} />
    </>
  );
}

function GroupName({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <div className="flex min-w-0 flex-[1_1_160px] flex-col">
      <h2 className="text-[15px] font-bold [overflow-wrap:anywhere]">{name}</h2>
      <span className="text-xs text-muted-foreground">{subtitle}</span>
    </div>
  );
}

function GroupCard({
  group,
  head,
  children,
}: {
  group: BoardGroup<BoardTask>;
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  const open = group.tasks.filter((t) => t.status !== "DONE").length;
  const overdue = group.tasks.filter((t) => t.isOverdue).length;
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border bg-card text-card-foreground",
        group.kind === "needsOwner" && "border-warning/45",
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3 sm:px-[18px] sm:py-3.5">
        {head}
        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums">
          {overdue > 0 && (
            <>
              <span className="font-semibold text-destructive">
                {overdue} overdue
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{open} open</span>
        </div>
      </div>
      {children}
    </section>
  );
}
