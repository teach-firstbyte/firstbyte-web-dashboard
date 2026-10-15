import { PageHeader } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { MemberAttendanceTable } from "@/components/MemberAttendanceTable";
import { MemberStatusFilter } from "@/components/MemberStatusFilter";
import { PaginationControls } from "@/components/PaginationControls";
import { Banner } from "@/components/ui/banner";
import { getViewMode } from "@/lib/auth/viewMode";
import { listAttendancePageForMember } from "@/server/attendance/queries";
import { emptyPage, type Page } from "@/server/page";
import type { Viewer } from "@/server/viewer";
import type { MemberAttendanceRow } from "@/types/dashboard";
import { Suspense } from "react";

const PAGE_SIZE = 25;

export async function MemberAttendanceView({
  user,
  searchParams,
}: {
  user: Viewer;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  let result: Page<MemberAttendanceRow> = emptyPage();
  let dbUnavailable = false;

  try {
    result = await listAttendancePageForMember(
      user,
      await searchParams,
      PAGE_SIZE,
    );
  } catch (error) {
    // Not a ServiceError -- this query throws none. This is the database being
    // unreachable, and the banner below is the whole reason we catch it.
    dbUnavailable = true;
    console.error("Member attendance query failed:", error);
  }

  const emptyMessage = result.filtersActive
    ? "No records match this filter."
    : "You have no attendance records yet.";

  return (
    <AppShell viewer={user} mode={await getViewMode(user)}>
      {dbUnavailable && (
        <Banner variant="warning">
          Could not load your attendance right now. Showing an empty view until
          the connection is restored.
        </Banner>
      )}
      <PageHeader
        title="My attendance"
        description="Every meeting you were expected at, and whether you came."
        action={
          <Suspense fallback={<div className="h-9" />}>
            <MemberStatusFilter />
          </Suspense>
        }
      />
      <MemberAttendanceTable rows={result.rows} emptyMessage={emptyMessage} />
      <PaginationControls
        page={result.page}
        totalPages={result.totalPages}
        hasPrev={result.hasPrev}
        hasNext={result.hasNext}
      />
    </AppShell>
  );
}
