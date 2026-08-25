import { AccountStatus } from "@prisma/client";
import { requireSignedInUser } from "@/lib/auth/requireApprovedUser";
import { assertStatusAllowed } from "@/lib/auth/accountGate";
import { listActiveTeams, listOwnTeamRequests } from "@/server/teams/queries";
import { SubmitButton } from "@/components/SubmitButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Banner } from "@/components/ui/banner";
import { logOut } from "../login/actions";
import { OnboardingForm } from "./OnboardingForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OnboardingPage() {
  // requireSignedInUser, not requireApprovedUser -- gating this page on being
  // approved is exactly what would produce a redirect loop.
  const user = await requireSignedInUser("/onboarding");

  // PENDING is allowed here: that is the "edit my submission" affordance.
  assertStatusAllowed(user, [AccountStatus.ONBOARDING, AccountStatus.PENDING]);

  const isEditing = user.status === AccountStatus.PENDING;

  // Read teams through the data layer, never fetch("/api/teams") -- that route
  // is officer-gated and would 403 the exact user who needs it.
  const [teams, requests] = await Promise.all([
    listActiveTeams(),
    listOwnTeamRequests(user.id),
  ]);

  return (
    <div className="container mx-auto max-w-2xl p-6 space-y-6">
      {isEditing && (
        <Banner variant="warning">
          Your account is already waiting for review. Changes here update what
          the officers see.
        </Banner>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            {isEditing ? "Edit your submission" : "Tell us about yourself"}
          </CardTitle>
          <CardDescription>
            {isEditing
              ? "Update your details or change which teams you asked to join."
              : "One more step before an officer can review your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              There are no teams to join right now. Check back later, or reach
              out to an officer.
            </p>
          ) : (
            <OnboardingForm
              teams={teams}
              requests={requests}
              defaults={{
                preferredName: user.preferredName,
                pronouns: user.pronouns,
                gradYear: user.gradYear,
                major: user.major,
              }}
              isEditing={isEditing}
            />
          )}
        </CardContent>
      </Card>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <form>
          <SubmitButton
            formAction={logOut}
            variant="outline"
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
