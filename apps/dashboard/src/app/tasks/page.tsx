import type { Metadata } from "next";

import { PageHeader } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { Banner } from "@/components/ui/banner";
import { requireTaskAccess } from "@/lib/auth/requireTaskAccess";
import { isSuperAdmin } from "@/lib/auth/roles";
import { getViewMode } from "@/lib/auth/viewMode";
import { parseOwnerFilter, parseTeamFilter } from "@/lib/tasks/board";
import { getTaskBoard, type TaskBoardData } from "@/server/tasks/board";
import { enumParam, firstParam } from "@/server/validation";

export const metadata: Metadata = { title: "Tasks · FirstByte Dashboard" };

/**
 * The e-board's task board: what each person and team owes, as To do, In
 * progress and Done columns (the default) or grouped by person or team.
 *
 * Approved e-board members and super admins only. requireTaskAccess sends
 * everyone else to Home, and the API refuses them on its own as well.
 */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { user } = await requireTaskAccess();
  const params = await searchParams;

  let board: TaskBoardData | null = null;
  try {
    board = await getTaskBoard(user);
  } catch (error) {
    console.error("Tasks query failed:", error);
  }

  return (
    <AppShell viewer={user} mode={await getViewMode(user)}>
      {board ? (
        <TaskBoard
          {...board}
          viewerId={user.id}
          canManageSlack={isSuperAdmin(user)}
          initialFilters={{
            view: enumParam(params.view, ["list"] as const) ?? "board",
            groupBy: enumParam(params.group, ["team"] as const) ?? "owner",
            mine: firstParam(params.mine) === "1",
            showDone: firstParam(params.done) === "1",
            ownerId: parseOwnerFilter(firstParam(params.person)),
            teamId: parseTeamFilter(firstParam(params.team)),
          }}
        />
      ) : (
        <>
          <PageHeader title="Tasks" />
          <Banner variant="warning">
            Could not load tasks right now. Try again in a moment.
          </Banner>
        </>
      )}
    </AppShell>
  );
}
