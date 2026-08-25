import Link from "next/link";
import { AccountStatus, TeamMemberStatus } from "@prisma/client";
import { requireSignedInUser } from "@/lib/auth/requireApprovedUser";
import { assertStatusAllowed } from "@/lib/auth/accountGate";
import { listOwnTeamRequests } from "@/server/teams/queries";
import { SubmitButton } from "@/components/SubmitButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Banner } from "@/components/ui/banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DetailEmpty,
  DetailField,
  DetailGrid,
  DetailSection,
} from "@/components/ui/detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logOut } from "../login/actions";

function TeamRequestBadge({ status }: { status: TeamMemberStatus }) {
  switch (status) {
    case TeamMemberStatus.APPROVED:
      return <Badge>Approved</Badge>;
    case TeamMemberStatus.REJECTED:
      return <Badge variant="destructive">Not approved</Badge>;
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}

export default async function PendingPage() {
  const user = await requireSignedInUser("/pending");
  assertStatusAllowed(user, [AccountStatus.PENDING, AccountStatus.DENIED]);

  const denied = user.status === AccountStatus.DENIED;

  const memberships = await listOwnTeamRequests(user.id);

  return (
    <div className="container mx-auto max-w-2xl p-6 space-y-6">
      {denied ? (
        <Banner variant="destructive">
          Your request to join FirstByte was not approved. If you think that is
          a mistake, reach out to an officer.
        </Banner>
      ) : (
        <Banner variant="warning">
          Your account is waiting for an officer to review it. You&apos;ll get
          access as soon as it&apos;s approved.
        </Banner>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What you submitted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <DetailSection title="About you">
            <DetailGrid>
              <DetailField label="Name" value={user.name} />
              <DetailField label="Preferred name" value={user.preferredName} />
              <DetailField label="Pronouns" value={user.pronouns} />
              <DetailField label="Email" value={user.email} />
              <DetailField label="Graduation year" value={user.gradYear} />
              <DetailField label="Major" value={user.major} />
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Teams you asked to join">
            {memberships.length === 0 ? (
              <DetailEmpty>No teams requested.</DetailEmpty>
            ) : (
              <ul className="space-y-2">
                {memberships.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 break-words">{m.team.name}</span>
                    <TeamRequestBadge status={m.status} />
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <ThemeToggle />
        {/* No edit affordance once denied -- the action refuses those writes,
            so offering it would only produce an error. */}
        {!denied && (
          <Button asChild variant="outline">
            <Link href="/onboarding">Edit my submission</Link>
          </Button>
        )}
        <form>
          <SubmitButton
            formAction={logOut}
            variant="brand"
            className="text-sm px-3 py-1.5 rounded-md"
            pendingLabel="Logging Out..."
          >
            Log out
          </SubmitButton>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">
        Signed in as {user.email}.
      </p>
    </div>
  );
}
