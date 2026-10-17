import { ShieldCheck } from "lucide-react";

import type { DraftChecks } from "@/types/newsletter";

/**
 * What the safeguards did to one draft, in counts. Never the removed text
 * itself: that would put the private detail right back on the screen.
 */
export function SafeguardSummary({ checks }: { checks: DraftChecks }) {
  const rows: string[] = [];
  if (checks.privateSkipped) {
    rows.push(
      `${checks.privateSkipped} message${checks.privateSkipped === 1 ? "" : "s"} from private channels or DMs never read`,
    );
  }
  for (const r of checks.redactions ?? []) {
    rows.push(`Removed before the AI saw it: ${r.reason} (${r.count})`);
  }
  for (const r of checks.messagesDropped ?? []) {
    rows.push(`Left out entirely: ${r.reason} (${r.count})`);
  }
  if (checks.linesDropped) {
    rows.push(
      `${checks.linesDropped} AI line${checks.linesDropped === 1 ? "" : "s"} dropped for citing nothing real`,
    );
  }
  if (checks.linesFlagged) {
    rows.push(
      `${checks.linesFlagged} line${checks.linesFlagged === 1 ? "" : "s"} highlighted: based only on conversation`,
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        What the safeguards did
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing needed removing this week.
        </p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          {rows.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {checks.model && (
        <p className="text-xs text-muted-foreground">
          Drafted by {checks.model}. Nothing reaches members until this team and
          a final approver approve it.
        </p>
      )}
    </div>
  );
}
