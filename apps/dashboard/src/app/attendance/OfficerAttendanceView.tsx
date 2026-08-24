import { AttendanceTable } from "@/components/AttendanceTable";
import { BackLink } from "@/components/BackLink";
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
  await requireOfficer();

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
    <div className="container mx-auto p-6">
      {dbUnavailable && (
        <Banner variant="warning" className="mb-4">
          Could not load attendance right now. Showing an empty view until the
          connection is restored.
        </Banner>
      )}
      <BackLink />
      <div className="mt-4 mb-4">
        <Suspense fallback={<div className="h-9" />}>
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <SearchInput />
            </div>
            <StatusFilter />
          </div>
        </Suspense>
      </div>
      <div className="mt-4">
        <AttendanceTable attendance={result.rows} emptyMessage={emptyMessage} />
      </div>
      <PaginationControls
        page={result.page}
        totalPages={result.totalPages}
        hasPrev={result.hasPrev}
        hasNext={result.hasNext}
      />
    </div>
  );
}
