import { Badge } from "@/components/ui/badge";
import type {
  NewsletterIssueStatusValue,
  TeamUpdateStatusValue,
} from "@/lib/enums";
import type { SourceRef } from "@/types/newsletter";

const ISSUE: Record<
  NewsletterIssueStatusValue,
  { label: string; variant: "warning" | "success" | "muted" | "default" }
> = {
  COLLECTING: { label: "Leads editing", variant: "warning" },
  READY: { label: "Ready for approval", variant: "warning" },
  APPROVED: { label: "Approved, waiting to send", variant: "success" },
  SENT: { label: "Sent", variant: "default" },
  NOT_SENT: { label: "Not sent", variant: "muted" },
};

export function IssueStatusBadge({
  status,
}: {
  status: NewsletterIssueStatusValue;
}) {
  const s = ISSUE[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const UPDATE: Record<
  TeamUpdateStatusValue,
  { label: string; variant: "warning" | "success" | "muted" }
> = {
  DRAFT: { label: "Draft waiting", variant: "warning" },
  APPROVED: { label: "Approved", variant: "success" },
  SKIPPED: { label: "Skipped this week", variant: "muted" },
};

export function UpdateStatusBadge({
  status,
}: {
  status: TeamUpdateStatusValue;
}) {
  const s = UPDATE[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const KIND_LABEL: Record<SourceRef["kind"], string> = {
  github: "GitHub",
  slack: "Slack",
  meeting: "Dashboard",
};

/** Where a line came from, as small chips. Links open in a new tab. */
export function SourceChips({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">Written by a person</span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {sources.map((s) => {
        const text = `${KIND_LABEL[s.kind]} · ${s.label}`;
        return s.url ? (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-primary"
          >
            {text}
          </a>
        ) : (
          <span
            key={s.id}
            className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground"
          >
            {text}
          </span>
        );
      })}
    </span>
  );
}
