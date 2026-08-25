import Image from "next/image";
import { UsersTable } from "@/components/UsersTable";
import { TeamsTable } from "@/components/TeamsTable";
import { MeetingsTable } from "@/components/MeetingsTable";
import { FeedbackTable } from "@/components/FeedbackTable";
import type {
  Feedback,
  Meeting,
  PendingUser,
  Team,
  User,
} from "@/types/dashboard";
import { logOut } from "./login/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Viewer } from "@/server/viewer";
import { OfficerBadge } from "@/components/OfficerBadge";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { getOfficerDashboard } from "@/server/dashboard/queries";
import { SuggestionBoxLink } from "@/components/SuggestionBoxLink";
import { USER_SORT_FIELDS } from "@/server/users/queries";
import { enumParam } from "@/server/validation";
import { Suspense } from "react";

export async function OfficerDashboard({
  user,
  searchParams,
}: {
  user: Viewer;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = (await searchParams) ?? {};
  const userSort = enumParam(params.sort, USER_SORT_FIELDS);
  const userSortDir = enumParam(params.dir, ["asc", "desc"] as const);

  const emptyData = {
    users: [] as User[],
    pending: [] as PendingUser[],
    teams: [] as Team[],
    meetings: [] as Meeting[],
    attendance: {
      rate: null as number | null,
      present: 0,
      absent: 0,
    },
    feedback: [] as Feedback[],
  };

  let data = emptyData;
  let dbUnavailable = false;

  try {
    // One round of parallel queries, inside the service. If this fails, render
    // the dashboard with empty state data and the banner below.
    data = await getOfficerDashboard(user, userSort, userSortDir);
  } catch (error) {
    dbUnavailable = true;
    console.error(
      "Database unavailable, rendering empty dashboard state:",
      error,
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <Image
          src="/FirstByteBitex4.png"
          alt="FirstByte"
          width={200}
          height={200}
          className="mx-auto mb-4"
        />
        <h1 className="text-3xl font-bold">FirstByte Dashboard</h1>
        <p className="text-muted-foreground">
          Participation and engagement tracking
        </p>
        {/* Unconditional: this component only renders behind isOfficer() in
            page.tsx, so anyone reading it is an officer by definition. */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">
            Signed in as {user.name ?? user.email}
          </span>
          <OfficerBadge />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button
          asChild
          variant="outline"
          className="text-sm px-3 py-1.5 rounded-md"
        >
          <Link href="/settings">Settings</Link>
        </Button>
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
      {dbUnavailable && (
        <Banner variant="warning">
          Could not load database data right now. Showing an empty dashboard
          until the connection is restored.
        </Banner>
      )}

      <div className="grid gap-6 [*&>*]:min-w-0">
        {/* First in the grid: it is the action item, everything below is
            reference data. */}
        <ApprovalQueue users={data.pending} />
        <Suspense fallback={null}>
          <UsersTable users={data.users} />
        </Suspense>
        <TeamsTable teams={data.teams} />
        <MeetingsTable meetings={data.meetings} />
        <Card>
          <CardHeader>
            <CardTitle>Attendance Rate</CardTitle>
            <CardDescription>
              Present out of all decided (present + absent)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.attendance.rate !== null
                ? `${Math.round(data.attendance.rate * 100)}%`
                : "-"}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {data.attendance.rate !== null
                ? `${data.attendance.present} Present · ${data.attendance.absent} Absent`
                : "-"}
            </p>
            <Link
              href="/attendance"
              className="text-sm text-primary hover:underline mt-3 inline-block"
            >
              View all records
            </Link>
          </CardContent>
        </Card>
        <FeedbackTable feedback={data.feedback} />
      </div>
      <div className="flex justify-center border-t pt-6">
        <SuggestionBoxLink />
      </div>
    </div>
  );
}
