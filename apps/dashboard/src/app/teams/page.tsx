import { PageHeader } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { TeamsTable } from "@/components/teams/TeamsTable";
import { Banner } from "@/components/ui/banner";
import { requireOfficer } from "@/lib/auth/requireOfficer";
import { isSuperAdmin } from "@/lib/auth/roles";
import { listTeams } from "@/server/teams/queries";
import type { Team } from "@/types/dashboard";

export default async function TeamsPage() {
  const user = await requireOfficer();

  let teams: Team[] = [];
  let dbUnavailable = false;
  try {
    teams = await listTeams();
  } catch (error) {
    dbUnavailable = true;
    console.error("Teams query failed:", error);
  }

  return (
    <AppShell viewer={user} mode="officer">
      {dbUnavailable && (
        <Banner variant="warning">
          Could not load teams right now. Showing an empty list until the
          connection is restored.
        </Banner>
      )}
      <PageHeader title="Teams" />
      <TeamsTable teams={teams} canManageRestricted={isSuperAdmin(user)} />
    </AppShell>
  );
}
