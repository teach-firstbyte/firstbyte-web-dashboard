import { Suspense } from "react";
import { requireApprovedUser } from "@/lib/auth/requireApprovedUser";
import { OfficerDashboard } from "./OfficerDashboard";
import { getViewMode } from "@/lib/auth/viewMode";
import { MemberDashboard } from "./MemberDashboard";
import { TerminalBoot } from "@/components/layout/TerminalBoot";

export default async function Home() {
  const user = await requireApprovedUser();
  // getViewMode, not isOfficer: same answer for everyone except an officer who
  // has asked to preview the member view. It re-checks the role internally, so
  // this is not a weaker gate than the isOfficer call it replaced.
  const view = await getViewMode(user);

  // The gate stays outside the Suspense boundary on purpose. A redirect thrown
  // after the loading screen has started streaming cannot be a real 307 any
  // more, so a signed-out visitor would see the terminal boot and then be sent
  // to /login. Here they are redirected before anything is sent.
  return (
    <Suspense fallback={<TerminalBoot />}>
      {view === "officer" ? (
        <OfficerDashboard user={user} />
      ) : (
        <MemberDashboard user={user} />
      )}
    </Suspense>
  );
}
