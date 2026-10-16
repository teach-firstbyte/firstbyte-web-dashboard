import { Undo2 } from "lucide-react";

import { setViewMode } from "@/app/actions/viewMode";
import { SubmitButton } from "@/components/SubmitButton";

// .bind is how a server action takes an argument from a form: it produces a new
// action with the mode already applied, so nothing has to travel through a
// hidden input the client could edit.
const switchToOfficer = setViewMode.bind(null, "officer" as const);

/**
 * The way back out, shown above every page an officer is previewing.
 *
 * Without this the preview is a trap: the member nav has no officer links, so
 * an officer who forgets they switched has no visible route back.
 */
export function MemberPreviewBanner() {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-warning/40 bg-warning/10 py-1.5 pr-1.5 pl-4 text-sm"
    >
      <span>
        <strong className="font-semibold text-warning-foreground">
          Member preview.
        </strong>{" "}
        This is what members see. Your officer tools still work.
      </span>
      <form>
        <SubmitButton
          formAction={switchToOfficer}
          variant="outline"
          size="sm"
          pendingLabel="Switching…"
        >
          <Undo2 className="size-4" />
          Back to officer view
        </SubmitButton>
      </form>
    </div>
  );
}
