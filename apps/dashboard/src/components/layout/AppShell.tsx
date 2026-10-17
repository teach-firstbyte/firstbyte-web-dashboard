import { isOfficer } from "@/lib/auth/roles";
import type { ViewMode } from "@/lib/auth/viewMode";
import type { Viewer } from "@/server/viewer";
import { SUGGESTION_BOX_URL } from "@/components/layout/links";
import { isNewsletterEnabled } from "@/lib/newsletter/enabled";
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
 */
export function AppShell({
  viewer,
  mode,
  children,
}: {
  viewer: Viewer;
  mode: ViewMode;
  children: React.ReactNode;
}) {
  const officer = isOfficer(viewer);

  return (
    <div className="mx-auto grid w-full max-w-[1120px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-4 pb-16">
      {officer && mode === "member" && <MemberPreviewBanner />}
      <AppNav
        mode={mode}
        canSwitchView={officer}
        showNewsletter={isNewsletterEnabled()}
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
