import { isOfficer } from "@/lib/auth/roles";
import { canAccessTasks } from "@/lib/auth/taskPolicy";
import { getTaskActor } from "@/server/tasks/queries";
import type { ViewMode } from "@/lib/auth/viewMode";
import type { Viewer } from "@/server/viewer";
import { SUGGESTION_BOX_URL } from "@/components/layout/links";
import { AppNav } from "./AppNav";
import { MemberPreviewBanner } from "./MemberPreviewBanner";

/**
 * The frame around every signed-in page: the pill top bar, the member-preview
 * banner for officers, and the footer.
 *
 * A component each page renders, rather than a shared layout.tsx. Pages gate
 * themselves with requireApprovedUser(returnTo) so a signed-out visitor on a
 * deep link (a QR code) is sent back there after logging in, and a layout
 * running its own gate in parallel would redirect first and lose that.
 *
 * Takes the Viewer and passes the client nav only the plain fields it shows,
 * never the whole user row.
 *
 * Async for one lookup: whether this person is on the e-board, which decides
 * the Tasks link. The same check the Tasks page and API gate on, so the link
 * shows exactly when the page would open.
 */
export async function AppShell({
  viewer,
  mode,
  children,
}: {
  viewer: Viewer;
  mode: ViewMode;
  children: React.ReactNode;
}) {
  const officer = isOfficer(viewer);
  const showTasks = await canOpenTasks(viewer);

  return (
    <div className="mx-auto grid w-full max-w-[1120px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-4 pb-16">
      {officer && mode === "member" && <MemberPreviewBanner />}
      <AppNav
        mode={mode}
        canSwitchView={officer}
        showTasks={showTasks}
        account={{
          name: viewer.preferredName || viewer.name,
          fullName: viewer.name,
          email: viewer.email,
          isOfficer: officer,
        }}
      />
      <main className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
        {children}
      </main>
      <footer className="flex flex-wrap justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
        <span>FirstByte · CS &amp; STEM education</span>
        <a
          href={SUGGESTION_BOX_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          Suggestion box
        </a>
      </footer>
    </div>
  );
}

/**
 * Whether to show the Tasks link. A failed lookup hides it rather than
 * breaking every page: the pages already show their own "could not load"
 * banner when the database is down.
 */
async function canOpenTasks(viewer: Viewer): Promise<boolean> {
  try {
    return canAccessTasks(await getTaskActor(viewer));
  } catch (error) {
    console.error("Tasks access lookup failed:", error);
    return false;
  }
}
