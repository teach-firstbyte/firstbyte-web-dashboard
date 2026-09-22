import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { OfficerDashboard } from "./OfficerDashboard";
import { getViewMode } from "@/lib/auth/viewMode";
import { MemberDashboard } from "./MemberDashboard";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireApprovedUser();
  // getViewMode, not isOfficer: same answer for everyone except an officer who
  // has asked to preview the member view. It re-checks the role internally, so
  // this is not a weaker gate than the isOfficer call it replaced.
  const view = await getViewMode(user);

  return view === "officer" ? (
    <OfficerDashboard user={user} searchParams={searchParams} />
  ) : (
    <MemberDashboard user={user} />
  );
}
