import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";
import { BackLink } from "@/components/BackLink";

export default async function UserSettingsPage() {
  const user = await requireApprovedUser("/settings");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <BackLink />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaults={{
              name: user.name,
              preferredName: user.preferredName,
              pronouns: user.pronouns,
              gradYear: user.gradYear,
              major: user.major,
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
