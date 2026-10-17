import { Prisma } from "@prisma/client";

import type {
  DraftChecks,
  IssueView,
  TeamUpdateView,
  UpdateLine,
} from "@/types/newsletter";

/** An issue with each team's part, for every newsletter screen. */
export const issueWithUpdatesArgs =
  Prisma.validator<Prisma.NewsletterIssueDefaultArgs>()({
    include: {
      approvedBy: { select: { name: true, preferredName: true } },
      updates: {
        include: {
          team: { select: { name: true } },
          decidedBy: { select: { name: true, preferredName: true } },
        },
        orderBy: { team: { name: "asc" } },
      },
    },
  });

export type IssueWithUpdates = Prisma.NewsletterIssueGetPayload<
  typeof issueWithUpdatesArgs
>;

function displayName(
  user: { name: string | null; preferredName: string | null } | null,
) {
  return user ? user.preferredName || user.name : null;
}

/**
 * The JSON columns are written only by this module, but they are still read
 * defensively: a malformed row renders as an empty draft, never a crash.
 */
function asLines(value: Prisma.JsonValue): UpdateLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return [];
    const { text, sources, flagged } = v as Record<string, unknown>;
    if (typeof text !== "string") return [];
    return [
      {
        text,
        sources: Array.isArray(sources)
          ? (sources as UpdateLine["sources"])
          : [],
        flagged: flagged === true,
      },
    ];
  });
}

function asChecks(value: Prisma.JsonValue): DraftChecks {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DraftChecks)
    : {};
}

/** Dates as ISO strings, so the result can be handed to client components. */
export function toIssueView(issue: IssueWithUpdates): IssueView {
  return {
    id: issue.id,
    weekOf: issue.weekOf.toISOString(),
    status: issue.status,
    note: issue.note,
    approvedAt: issue.approvedAt?.toISOString() ?? null,
    approvedByName: displayName(issue.approvedBy),
    sentAt: issue.sentAt?.toISOString() ?? null,
    sentCount: issue.sentCount,
    updates: issue.updates.map((u): TeamUpdateView => ({
      id: u.id,
      teamId: u.teamId,
      teamName: u.team.name,
      status: u.status,
      lines: asLines(u.lines),
      aiLines: asLines(u.aiLines),
      checks: asChecks(u.checks),
      aiError: u.aiError,
      photo: u.photo,
      decidedAt: u.decidedAt?.toISOString() ?? null,
      decidedByName: displayName(u.decidedBy),
    })),
  };
}
