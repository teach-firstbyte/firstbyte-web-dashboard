import { AttendanceTable } from "@/components/AttendanceTable";
import { PageHeader } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { PaginationControls } from "@/components/PaginationControls";
import { SearchInput } from "@/components/SearchInput";
import { StatusFilter } from "@/components/StatusFilter";
import { Banner } from "@/components/ui/banner";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { listAttendancePageForOfficer } from "@/server/attendance/queries";
import type { AttendanceWithContext } from "@/server/attendance/select";
import { emptyPage, type Page } from "@/server/page";
import { Suspense } from "react";

const PAGE_SIZE = 25;

export async function OfficerAttendanceView({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireOfficer();

  let result: Page<AttendanceWithContext> = emptyPage();
  let dbUnavailable = false;

  try {
    result = await listAttendancePageForOfficer(await searchParams, PAGE_SIZE);
  } catch (error) {
    // Not a ServiceError -- this query throws none. This is the database being
    // unreachable, and the banner below is the whole reason we catch it.
    dbUnavailable = true;
    console.error("Attendance query failed:", error);
  }

  const emptyMessage = result.filtersActive
    ? "No records match your filters."
    : "No attendance records yet.";

  return (
    <AppShell viewer={user} mode="officer">
      {dbUnavailable && (
        <Banner variant="warning">
          Could not load attendance right now. Showing an empty view until the
          connection is restored.
        </Banner>
      )}
      <PageHeader
        title="Attendance records"
        description="Every check-in and mark, across all meetings."
      />
      <Suspense fallback={<div className="h-9" />}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SearchInput />
          </div>
          <StatusFilter />
        </div>
      </Suspense>
      <AttendanceTable attendance={result.rows} emptyMessage={emptyMessage} />
      <PaginationControls
        page={result.page}
        totalPages={result.totalPages}
        hasPrev={result.hasPrev}
        hasNext={result.hasNext}
      />
    </AppShell>
  );
}
