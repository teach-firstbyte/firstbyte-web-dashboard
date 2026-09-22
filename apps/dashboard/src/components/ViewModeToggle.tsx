import { Eye, Undo2 } from "lucide-react";

import { setViewMode } from "@/app/actions/viewMode";
import { Banner } from "@/components/ui/banner";
import { SubmitButton } from "@/components/SubmitButton";

// .bind is how a server action takes an argument from a form: it produces a new
// action with the mode already applied, so nothing has to travel through a
// hidden input the client could edit.
const switchToMember = setViewMode.bind(null, "member" as const);
const switchToOfficer = setViewMode.bind(null, "officer" as const);

/**
 * "View as member", for the officer dashboard footer.
 *
 * Render this only inside an officer view -- it has no role check of its own,
 * because setViewMode re-checks on the server and getViewMode ignores the
 * cookie for non-officers. A stray render is inert, not a hole.
 */
export function ViewModeToggle({ className }: { className?: string }) {
  return (
    <form className={className}>
      <SubmitButton
        formAction={switchToMember}
        variant="outline"
        className="text-sm px-3 py-1.5 rounded-md"
        pendingLabel="Switching..."
        title="See the dashboard the way a member sees it"
      >
        <Eye className="size-4" />
        View as member
      </SubmitButton>
    </form>
  );
}

/**
 * The way back out, shown above every page an officer is previewing.
 *
 * Without this the preview is a trap: the member view has no officer
 * navigation in it, so an officer who forgets they switched has no visible
 * route back to the tables.
 */
export function MemberPreviewBanner() {
  return (
    <Banner
      variant="warning"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <span>
        <strong className="font-medium">Previewing as a member.</strong> This
        changes what you see, not what you can do -- officer pages and actions
        still work.
      </span>
      <form>
        <SubmitButton
          formAction={switchToOfficer}
          variant="outline"
          size="sm"
          pendingLabel="Switching..."
        >
          <Undo2 className="size-4" />
          Back to officer view
        </SubmitButton>
      </form>
    </Banner>
  );
}
