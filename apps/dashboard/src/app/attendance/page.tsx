import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { getViewMode } from "@/lib/auth/viewMode";
import { OfficerAttendanceView } from "./OfficerAttendanceView";
import { MemberAttendanceView } from "./MemberAttendanceView";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireApprovedUser("/attendance");
  const view = await getViewMode(user);

  if (view === "officer") {
    return <OfficerAttendanceView searchParams={searchParams} />;
  }

  return <MemberAttendanceView user={user} searchParams={searchParams} />;
}
