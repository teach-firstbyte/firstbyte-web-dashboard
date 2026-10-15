import { AccountStatus } from "@prisma/client";

import { PasswordForm } from "@/components/account/PasswordForm";
import { ProfileForm } from "@/components/account/ProfileForm";
import {
  TeamMemberships,
  type TeamRow,
} from "@/components/account/TeamMemberships";
import { ThemePicker } from "@/components/account/ThemePicker";
import { PageHeader, Section } from "@/components/common/Section";
import { AppShell } from "@/components/layout/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import { getSession } from "@/lib/auth/getSession";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { getViewMode } from "@/lib/auth/viewMode";
import { listActiveTeams, listOwnTeamRequests } from "@/server/teams/queries";
import { logOut } from "../login/actions";

export default async function UserSettingsPage() {
  const user = await requireApprovedUser("/settings");
  const [mode, session, joinable, requests] = await Promise.all([
    getViewMode(user),
    getSession(),
    listActiveTeams(),
    listOwnTeamRequests(user.id),
  ]);

  // Teams you could join, plus any you're already tied to (which includes
  // invite-only ones a super admin put you on).
  const byTeam = new Map(requests.map((r) => [r.teamId, r]));
  const rows: TeamRow[] = [
    ...joinable.map((t) => ({
      teamId: t.id,
      name: t.name,
      description: t.description,
      inviteOnly: false,
      membership: byTeam.get(t.id)
        ? { id: byTeam.get(t.id)!.id, status: byTeam.get(t.id)!.status }
        : null,
    })),
    ...requests
      .filter((r) => !joinable.some((t) => t.id === r.teamId))
      .map((r) => ({
        teamId: r.teamId,
        name: r.team.name,
        description: null,
        // Not in the joinable list: invite-only, or no longer open.
        inviteOnly: true,
        membership: { id: r.id, status: r.status },
      })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  // Google-only accounts have no password to change.
  const providers =
    session.kind === "anonymous"
      ? []
      : ((session.authUser.app_metadata?.providers as string[] | undefined) ?? [
          session.authUser.app_metadata?.provider as string,
        ]);
  const hasPassword = providers.includes("email");

  return (
    <AppShell viewer={user} mode={mode}>
      <PageHeader title="Settings" />
      <div className="flex max-w-3xl flex-col gap-5">
        <Section title="Profile">
          <ProfileForm
            defaults={{
              name: user.name,
              preferredName: user.preferredName,
              pronouns: user.pronouns,
              gradYear: user.gradYear,
              major: user.major,
              email: user.email,
            }}
          />
        </Section>

        {user.status === AccountStatus.APPROVED && (
          <Section id="teams" title="Teams">
            <p className="-mt-1 text-sm text-muted-foreground">
              Ask to join a team and an officer will review your request.
            </p>
            <TeamMemberships teams={rows} />
          </Section>
        )}

        <Section title="Sign-in">
          {hasPassword ? (
            <PasswordForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              You sign in with Google, so there&apos;s no FirstByte password to
              change.
            </p>
          )}
        </Section>

        <Section title="Appearance">
          <ThemePicker />
        </Section>

        <form>
          <SubmitButton
            formAction={logOut}
            variant="outline"
            className="text-destructive"
            pendingLabel="Logging out…"
          >
            Log out
          </SubmitButton>
        </form>
      </div>
    </AppShell>
  );
}
