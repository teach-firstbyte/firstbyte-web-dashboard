import { Suspense } from "react";

import { PageHeader } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { ExportMembersButton } from "@/components/members/ExportMembersDialog";
import { UsersTable } from "@/components/members/UsersTable";
import { SearchInput } from "@/components/SearchInput";
import { Banner } from "@/components/ui/banner";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { isSuperAdmin } from "@/lib/auth/roles";
import { listUsers, USER_SORT_FIELDS } from "@/server/users/queries";
import { enumParam, searchParam } from "@/server/validation";
import type { User } from "@/types/dashboard";

/**
 * Every approved member, with search, sorting, Assign teams and CSV export.
 * This used to be a table on the officer home; it moved here because it's for
 * looking things up, not for daily work.
 */
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireOfficer();
  const params = await searchParams;

  let users: User[] = [];
  let dbUnavailable = false;
  try {
    users = await listUsers(
      searchParam(params.q),
      enumParam(params.sort, USER_SORT_FIELDS),
      enumParam(params.dir, ["asc", "desc"] as const),
    );
  } catch (error) {
    dbUnavailable = true;
    console.error("Members query failed:", error);
  }

  return (
    <AppShell viewer={user} mode="officer">
      {dbUnavailable && (
        <Banner variant="warning">
          Could not load members right now. Showing an empty list until the
          connection is restored.
        </Banner>
      )}
      <PageHeader
        title="Members"
        description="New sign-ups are approved from the home page."
        action={<ExportMembersButton size="default" />}
      />
      <Suspense fallback={null}>
        <UsersTable users={users} canManageRestricted={isSuperAdmin(user)}>
          <SearchInput placeholder="Search by name or email…" />
        </UsersTable>
      </Suspense>
    </AppShell>
  );
}
