import { BackLink } from "@/components/BackLink";
import { MemberAttendanceTable } from "@/components/MemberAttendanceTable";
import { MemberStatusFilter } from "@/components/MemberStatusFilter";
import { PaginationControls } from "@/components/PaginationControls";
import { Banner } from "@/components/ui/banner";
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
    <div className="container mx-auto p-6">
      {dbUnavailable && (
        <Banner variant="warning" className="mb-4">
          Could not load your attendance right now. Showing an empty view until
          the connection is restored.
        </Banner>
      )}
      <BackLink />
      <div className="mt-4 mb-4">
        <Suspense fallback={<div className="h-9" />}>
          <MemberStatusFilter />
        </Suspense>
      </div>
      <div className="mt-4">
        <MemberAttendanceTable rows={result.rows} emptyMessage={emptyMessage} />
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
