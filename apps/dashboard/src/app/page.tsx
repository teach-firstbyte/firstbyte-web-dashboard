import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { OfficerDashboard } from "./OfficerDashboard";
import { isOfficer } from "@/lib/auth/roles";
import { MemberDashboard } from "./MemberDashboard";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireApprovedUser();

  return isOfficer(user) ? (
    <OfficerDashboard user={user} searchParams={searchParams} />
  ) : (
    <MemberDashboard user={user} />
  );
}
