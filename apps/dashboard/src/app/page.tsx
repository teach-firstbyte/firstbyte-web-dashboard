import { Suspense } from "react";
import { headers } from "next/headers";
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
  const Dashboard = view === "officer" ? OfficerDashboard : MemberDashboard;

  // The terminal boot screen is for full page loads only: arriving from the
  // website's "Get Involved" button, or a refresh. The router's own requests
  // (clicking Home, router.refresh()) send an RSC header and server actions a
  // Next-Action header. For those the dashboard is rendered before returning,
  // so the boundary never suspends and the old page stays up until the new one
  // is ready, as it did before this screen existed.
  //
  // The Suspense element itself is always rendered. Dropping it for router
  // requests would change the tree's shape, and React would remount the whole
  // dashboard (losing open dialogs) on every router.refresh().
  const requestHeaders = await headers();
  const fullPageLoad =
    !requestHeaders.has("rsc") && !requestHeaders.has("next-action");

  // The gate above stays outside the boundary on purpose. A redirect thrown
  // after the loading screen has started streaming cannot be a real 307 any
  // more, so a signed-out visitor would see the terminal boot and then be sent
  // to /login. Here they are redirected before anything is sent.
  return (
    <Suspense fallback={<TerminalBoot view={view} />}>
      {fullPageLoad ? <Dashboard user={user} /> : await Dashboard({ user })}
    </Suspense>
  );
}
